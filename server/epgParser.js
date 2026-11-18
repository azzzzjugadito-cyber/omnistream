import zlib from 'zlib';
import { logger } from './logger.js';

/**
 * Parsea una fecha en formato XMLTV: "YYYYMMDDHHmmss [+/-]ZZZZ"
 * Ejemplo: "20261118190000 +0100"
 */
export function parseXmltvDate(dateStr) {
  if (!dateStr || dateStr.length < 14) return null;
  try {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const min = dateStr.substring(10, 12);
    const sec = dateStr.substring(12, 14);

    let offsetStr = 'Z';
    if (dateStr.length >= 19) {
      const sign = dateStr[15];
      const offHour = dateStr.substring(16, 18);
      const offMin = dateStr.substring(18, 20);
      offsetStr = `${sign}${offHour}:${offMin}`;
    }

    const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}${offsetStr}`;
    return new Date(isoStr);
  } catch (err) {
    return null;
  }
}

/**
 * Parser ligero y seguro para guías EPG en formato XMLTV (soporta datos directos o comprimidos .gz).
 * Devuelve un mapa con channelId -> array de programas [{ title, start, stop, desc }].
 */
export function parseXmltv(rawBufferOrString) {
  let xml = '';

  try {
    if (Buffer.isBuffer(rawBufferOrString)) {
      // Comprobar número mágico gzip (0x1f, 0x8b)
      if (rawBufferOrString[0] === 0x1f && rawBufferOrString[1] === 0x8b) {
        xml = zlib.gunzipSync(rawBufferOrString).toString('utf8');
      } else {
        xml = rawBufferOrString.toString('utf8');
      }
    } else {
      xml = String(rawBufferOrString);
    }
  } catch (err) {
    logger.warn(`Error descomprimiendo XMLTV: ${err.message}`);
    return new Map();
  }

  const epgMap = new Map();
  if (!xml || !xml.includes('<tv')) return epgMap;

  // Extraer bloques <programme ...>...</programme>
  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  let match;

  while ((match = programmeRegex.exec(xml)) !== null) {
    const attrsStr = match[1];
    const innerContent = match[2];

    const channelMatch = attrsStr.match(/channel=["']([^"']+)["']/i);
    const startMatch = attrsStr.match(/start=["']([^"']+)["']/i);
    const stopMatch = attrsStr.match(/stop=["']([^"']+)["']/i);

    if (!channelMatch || !startMatch) continue;

    const channelId = channelMatch[1];
    const startDate = parseXmltvDate(startMatch[1]);
    const stopDate = stopMatch ? parseXmltvDate(stopMatch[1]) : null;

    // Extraer título y descripción
    const titleMatch = innerContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = innerContent.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'Sin título';
    const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';

    if (!epgMap.has(channelId)) {
      epgMap.set(channelId, []);
    }

    epgMap.get(channelId).push({
      title,
      desc,
      start: startDate ? startDate.toISOString() : null,
      stop: stopDate ? stopDate.toISOString() : null
    });
  }

  // Ordenar cronológicamente y recortar
  for (const [chId, progs] of epgMap.entries()) {
    progs.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  return epgMap;
}

/**
 * Obtiene el programa actual y el siguiente para un canal dado el timestamp actual.
 */
export function getCurrentAndNextProgram(programmes = [], now = new Date()) {
  if (!programmes.length) return { current: null, next: null };

  const nowMs = now.getTime();
  let current = null;
  let next = null;

  for (let i = 0; i < programmes.length; i++) {
    const p = programmes[i];
    const startMs = p.start ? new Date(p.start).getTime() : 0;
    const stopMs = p.stop ? new Date(p.stop).getTime() : 0;

    if (startMs <= nowMs && stopMs >= nowMs) {
      current = p;
      next = programmes[i + 1] || null;
      break;
    } else if (startMs > nowMs && !next) {
      next = p;
      break;
    }
  }

  return { current, next };
}
