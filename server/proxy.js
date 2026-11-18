import http from 'http';
import https from 'https';
import { URL } from 'url';
import { logger } from './logger.js';

// Agentes con keep-alive para máxima velocidad de streaming
const httpAgent = new http.Agent({ keepAlive: true, timeout: 15000 });
const httpsAgent = new https.Agent({ keepAlive: true, timeout: 15000, rejectUnauthorized: false });

/**
 * Reescribe listas M3U8 para que los fragmentos (.ts, .m4s) y sublistas
 * pasen a través del proxy interno con sus cabeceras necesarias.
 */
function rewriteM3u8(content, baseUrl, customHeaders = {}) {
  const lines = content.split(/\r?\n/);
  const baseObj = new URL(baseUrl);
  const ref = customHeaders['Referer'] || '';
  const ua = customHeaders['User-Agent'] || '';

  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Reescribir URIs en etiquetas EXT-X-KEY o EXT-X-MAP
    if (trimmed.startsWith('#EXT-X-KEY:') || trimmed.startsWith('#EXT-X-MAP:')) {
      return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
        const resolvedUri = new URL(uri, baseUrl).toString();
        const proxiedUri = `/api/proxy/stream?url=${encodeURIComponent(resolvedUri)}&ref=${encodeURIComponent(ref)}&ua=${encodeURIComponent(ua)}`;
        return `URI="${proxiedUri}"`;
      });
    }

    // Líneas de comentario y directivas no reescribibles
    if (trimmed.startsWith('#')) {
      return line;
    }

    // Es una URL de segmento o sub-playlist
    try {
      const resolved = new URL(trimmed, baseUrl).toString();
      return `/api/proxy/stream?url=${encodeURIComponent(resolved)}&ref=${encodeURIComponent(ref)}&ua=${encodeURIComponent(ua)}`;
    } catch {
      return line;
    }
  });

  return rewritten.join('\n');
}

/**
 * Controlador principal del proxy de streaming con soporte de Range y CORS.
 */
export async function handleStreamProxy(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: `URL inválida: ${targetUrl}` });
  }

  // Resolver cabeceras personalizadas
  const customReferer = req.query.ref || req.headers['x-target-referer'];
  const customUserAgent = req.query.ua || req.headers['x-target-user-agent'];

  const outboundHeaders = {
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Encoding': 'identity', // Evitar compresión que rompa Range
    'User-Agent': customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  };

  if (customReferer) {
    outboundHeaders['Referer'] = customReferer;
    outboundHeaders['Origin'] = new URL(customReferer).origin;
  }

  // Soporte crucial para HTTP Range (seek en MP4, MKV y HLS)
  if (req.headers.range) {
    outboundHeaders['Range'] = req.headers.range;
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;
  const agent = parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

  const requestOptions = {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    headers: outboundHeaders,
    agent,
    timeout: 12000
  };

  const proxyReq = client.request(requestOptions, (upstreamRes) => {
    const statusCode = upstreamRes.statusCode;

    // Manejo de redirecciones (301, 302, 307, 308)
    if ([301, 302, 303, 307, 308].includes(statusCode) && upstreamRes.headers.location) {
      const redirectUrl = new URL(upstreamRes.headers.location, targetUrl).toString();
      logger.debug(`Proxy siguiendo redirección hacia: ${redirectUrl}`);
      req.query.url = redirectUrl;
      return handleStreamProxy(req, res);
    }

    // Cabeceras CORS universales
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

    // Pasar cabeceras relevantes de la respuesta
    const contentType = upstreamRes.headers['content-type'] || '';
    if (contentType) res.setHeader('Content-Type', contentType);
    if (upstreamRes.headers['content-range']) res.setHeader('Content-Range', upstreamRes.headers['content-range']);
    if (upstreamRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges']);
    if (upstreamRes.headers['content-length']) res.setHeader('Content-Length', upstreamRes.headers['content-length']);

    // Si es una lista M3U8, la capturamos y reescribimos los enlaces
    const isM3u8 = contentType.includes('mpegurl') || 
                   contentType.includes('application/x-mpegURL') || 
                   parsedUrl.pathname.endsWith('.m3u8') ||
                   parsedUrl.pathname.endsWith('.m3u');

    if (isM3u8 && req.method !== 'HEAD' && statusCode === 200) {
      let body = '';
      upstreamRes.setEncoding('utf8');
      upstreamRes.on('data', chunk => { body += chunk; });
      upstreamRes.on('end', () => {
        try {
          const rewritten = rewriteM3u8(body, targetUrl, {
            'Referer': customReferer,
            'User-Agent': customUserAgent
          });
          res.status(200);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Content-Length', Buffer.byteLength(rewritten));
          res.send(rewritten);
        } catch (err) {
          logger.error(`Error reescribiendo M3U8: ${err.message}`);
          res.status(500).send(body);
        }
      });
      return;
    }

    // Para vídeo binario (fragmentos .ts, .m4s, .mp4, .mkv)
    res.status(statusCode);
    upstreamRes.pipe(res);

    upstreamRes.on('error', err => {
      logger.error(`Error en pipe upstream: ${err.message}`);
      if (!res.headersSent) res.status(502).json({ error: 'Fallo al transmitir stream' });
    });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Timeout contactando la fuente remota' });
    }
  });

  proxyReq.on('error', (err) => {
    logger.error(`Error en proxy a ${targetUrl}: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `Error conectando con la fuente: ${err.message}` });
    }
  });

  // Cancelar petición upstream si el cliente desconecta
  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
}
