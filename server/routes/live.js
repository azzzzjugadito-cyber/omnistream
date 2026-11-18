import express from 'express';
import { sourceManager } from '../sources/index.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * GET /api/live/channels
 * Lista canales en directo con filtros opcionales: sport, country, query, limit
 */
router.get('/channels', async (req, res) => {
  try {
    const filters = {
      sport: req.query.sport,
      country: req.query.country,
      competition: req.query.competition,
      isFootball: req.query.isFootball === 'true',
      query: req.query.q,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      onlySports: req.query.onlySports === 'true'
    };

    const channels = await sourceManager.getLiveChannels(filters);
    res.json({
      count: channels.length,
      channels
    });
  } catch (err) {
    logger.error(`Error en GET /api/live/channels: ${err.message}`);
    res.status(500).json({ error: 'Error al obtener canales en directo' });
  }
});

/**
 * GET /api/live/events
 * Lista partidos y eventos deportivos de la agenda
 */
router.get('/events', async (req, res) => {
  try {
    const filters = {
      sport: req.query.sport,
      competition: req.query.competition,
      country: req.query.country,
      todayOnly: req.query.today === 'true',
      query: req.query.q,
      lang: req.query.lang || 'es'
    };

    const events = await sourceManager.getSportsEvents(filters);
    res.json({
      count: events.length,
      events
    });
  } catch (err) {
    logger.error(`Error en GET /api/live/events: ${err.message}`);
    res.status(500).json({ error: 'Error al obtener eventos deportivos' });
  }
});

/**
 * GET /api/live/resolve
 * Resuelve el stream final y sus copias de seguridad para un canal o evento
 */
router.get('/resolve', async (req, res) => {
  try {
    const { sourceId, itemId, streamUrl } = req.query;

    if (streamUrl) {
      // Stream directo ya especificado
      const adapter = sourceId ? sourceManager.getAdapter(sourceId) : null;
      const headers = adapter ? adapter.headers : {};
      const ref = headers['Referer'] || '';
      const ua = headers['User-Agent'] || '';
      const proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&ref=${encodeURIComponent(ref)}&ua=${encodeURIComponent(ua)}`;

      return res.json({
        streamUrl,
        proxiedUrl,
        backupUrls: [],
        headers,
        type: streamUrl.includes('.m3u8') ? 'hls' : 'mp4'
      });
    }

    if (!sourceId || !itemId) {
      return res.status(400).json({ error: 'Falta sourceId o itemId' });
    }

    const resolved = await sourceManager.resolveStream(sourceId, itemId);
    res.json(resolved);
  } catch (err) {
    logger.error(`Error resolviendo stream: ${err.message}`);
    res.status(500).json({ error: `No se pudo resolver el stream: ${err.message}` });
  }
});

export default router;
