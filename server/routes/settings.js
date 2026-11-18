import express from 'express';
import os from 'os';
import fs from 'fs';
import axios from 'axios';
import { parseDocument } from 'yaml';
import { sourceManager } from '../sources/index.js';
import { runHealthChecks } from '../health.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const router = express.Router();

/**
 * Obtiene la lista de direcciones IP de red local (LAN)
 */
function getLanIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

// Lista de fuentes con estado de salud
router.get('/sources', (req, res) => {
  try {
    const sources = sourceManager.getSourcesList();
    res.json({ sources });
  } catch (err) {
    logger.error(`Error obteniendo fuentes: ${err.message}`);
    res.status(500).json({ error: 'Error al obtener fuentes' });
  }
});

// Recarga en caliente de sources.yaml
router.post('/reload-sources', async (req, res) => {
  try {
    const result = await sourceManager.reload();
    res.json(result);
  } catch (err) {
    logger.error(`Error recargando sources.yaml: ${err.message}`);
    res.status(500).json({ error: `Fallo al recargar: ${err.message}` });
  }
});

// Forzar comprobación de salud inmediata
router.post('/check-health', async (req, res) => {
  try {
    const results = await runHealthChecks();
    res.json({ success: true, results });
  } catch (err) {
    logger.error(`Error ejecutando comprobación de salud: ${err.message}`);
    res.status(500).json({ error: 'Fallo al comprobar salud' });
  }
});

// Ver logs recientes
router.get('/logs', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 150;
    const logs = logger.getRecentLogs(limit);
    res.json({ logs, isDebug: logger.isDebugEnabled() });
  } catch (err) {
    res.status(500).json({ error: 'Error leyendo logs' });
  }
});

// Cambiar modo depuración
router.post('/debug', (req, res) => {
  try {
    const { enabled } = req.body;
    logger.setDebug(!!enabled);
    res.json({ success: true, isDebug: logger.isDebugEnabled() });
  } catch (err) {
    res.status(500).json({ error: 'Error configurando depuración' });
  }
});

// Probar conexión con servidor Xtream Codes antes de guardar
router.post('/test-xtream', async (req, res) => {
  try {
    const { host, port, protocol, username, usernameEnv, password, passwordEnv } = req.body;
    const actualUser = (usernameEnv && process.env[usernameEnv]) || username;
    const actualPass = (passwordEnv && process.env[passwordEnv]) || password;

    if (!host || !actualUser || !actualPass) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios: servidor (host), usuario o contraseña.' 
      });
    }

    const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const proto = protocol || 'http';
    const numPort = parseInt(port, 10) || (proto === 'https' ? 443 : 80);
    const portPart = (numPort === 80 && proto === 'http') || (numPort === 443 && proto === 'https') ? '' : `:${numPort}`;
    const testUrl = `${proto}://${cleanHost}${portPart}/player_api.php?username=${encodeURIComponent(actualUser)}&password=${encodeURIComponent(actualPass)}`;

    const start = Date.now();
    const testRes = await axios.get(testUrl, { timeout: 7000 });
    const latencyMs = Date.now() - start;

    if (testRes.data && testRes.data.user_info) {
      const u = testRes.data.user_info;
      if (u.auth === 1 && u.status !== 'Disabled') {
        return res.json({
          success: true,
          message: `Conexión exitosa (${latencyMs} ms).`,
          userInfo: {
            username: u.username,
            status: u.status,
            expDate: u.exp_date ? new Date(parseInt(u.exp_date, 10) * 1000).toLocaleDateString() : 'Ilimitado',
            activeCons: u.active_cons,
            maxCons: u.max_connections
          },
          serverInfo: testRes.data.server_info
        });
      } else {
        return res.status(401).json({
          success: false,
          error: `Credenciales rechazadas por el servidor Xtream (Estado: ${u.status || 'No autorizado'})`
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'El servidor respondió pero no devolvió la estructura de autenticación de player_api.php'
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Error contactando servidor Xtream: ${err.response ? `HTTP ${err.response.status}` : err.message}`
    });
  }
});

// Guardar o actualizar proveedor Xtream en sources.yaml de forma retrocompatible
router.post('/save-xtream', async (req, res) => {
  try {
    const { 
      id, name, host, port, protocol, 
      username, usernameEnv, password, passwordEnv, 
      streamExt, priority, enabled 
    } = req.body;

    if (!host) {
      return res.status(400).json({ error: 'El host del servidor es obligatorio' });
    }

    const providerId = id || `xtream-${Date.now().toString(36)}`;
    const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const numPort = parseInt(port, 10) || (protocol === 'https' ? 443 : 80);

    // Leer sources.yaml actual preservando comentarios y formato AST
    const rawContent = fs.existsSync(config.sourcesFile) ? fs.readFileSync(config.sourcesFile, 'utf8') : 'sources:\n';
    const doc = parseDocument(rawContent);
    let sources = doc.get('sources');
    if (!sources) {
      doc.set('sources', []);
      sources = doc.get('sources');
    }

    const newEntry = {
      id: providerId,
      name: name || `Proveedor Xtream (${cleanHost})`,
      type: 'xtream',
      category: 'live',
      host: cleanHost,
      port: numPort,
      protocol: protocol || 'http',
      enabled: enabled !== false,
      priority: parseInt(priority, 10) || 1,
      streamExt: streamExt || 'm3u8',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    if (usernameEnv) newEntry.usernameEnv = usernameEnv;
    else if (username) newEntry.username = username;

    if (passwordEnv) newEntry.passwordEnv = passwordEnv;
    else if (password) newEntry.password = password;

    let existingIndex = -1;
    if (sources && sources.items) {
      for (let i = 0; i < sources.items.length; i++) {
        const item = sources.items[i];
        if (item && item.get && item.get('id') === providerId) {
          existingIndex = i;
          break;
        }
      }
    }

    if (existingIndex >= 0) {
      for (const [k, v] of Object.entries(newEntry)) {
        sources.items[existingIndex].set(k, v);
      }
    } else {
      sources.add(newEntry);
    }

    // Escribir sources.yaml preservando el formato original y todos los comentarios
    fs.writeFileSync(config.sourcesFile, doc.toString({ lineWidth: 0 }), 'utf8');

    // Recargar en caliente
    await sourceManager.reload();

    res.json({
      success: true,
      providerId,
      sources: sourceManager.getSourcesList()
    });
  } catch (err) {
    logger.error(`Error guardando proveedor Xtream: ${err.message}`);
    res.status(500).json({ error: `Fallo al guardar: ${err.message}` });
  }
});

// Eliminar proveedor Xtream de sources.yaml preservando comentarios
router.delete('/xtream/:id', async (req, res) => {
  try {
    const providerId = req.params.id;
    if (!fs.existsSync(config.sourcesFile)) {
      return res.status(404).json({ error: 'sources.yaml no encontrado' });
    }

    const rawContent = fs.readFileSync(config.sourcesFile, 'utf8');
    const doc = parseDocument(rawContent);
    const sources = doc.get('sources');

    if (sources && sources.items) {
      let existingIndex = -1;
      for (let i = 0; i < sources.items.length; i++) {
        const item = sources.items[i];
        if (item && item.get && item.get('id') === providerId) {
          existingIndex = i;
          break;
        }
      }
      if (existingIndex >= 0) {
        sources.delete(existingIndex);
        fs.writeFileSync(config.sourcesFile, doc.toString({ lineWidth: 0 }), 'utf8');
      }
    }

    await sourceManager.reload();
    res.json({ success: true, removed: providerId, sources: sourceManager.getSourcesList() });
  } catch (err) {
    logger.error(`Error eliminando proveedor: ${err.message}`);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
});

// Información del sistema y red para conectar el móvil (iPhone PWA)
router.get('/info', (req, res) => {
  const lanIps = getLanIps();
  const primaryIp = lanIps.length > 0 ? lanIps[0].address : '127.0.0.1';
  
  res.json({
    appName: 'OmniStream OTT',
    version: '1.0.0',
    port: config.port,
    primaryIp,
    lanIps,
    lanUrl: `http://${primaryIp}:${config.port}`,
    localUrl: `http://localhost:${config.port}`,
    platform: os.platform(),
    tmdbConfigured: !!config.tmdbApiKey
  });
});

export default router;
