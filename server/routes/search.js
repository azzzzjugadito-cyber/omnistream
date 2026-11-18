import express from 'express';
import { sourceManager } from '../sources/index.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * GET /api/search?q=...
 * Buscador global unificado: devuelve en paralelo canales en directo,
 * eventos deportivos y catálogo de cine y series bajo demanda.
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({ query: '', live: [], events: [], vod: [] });
    }

    const results = await sourceManager.globalSearch(query.trim());
    res.json({
      query: query.trim(),
      counts: {
        live: results.live.length,
        events: results.events.length,
        vod: results.vod.length,
        total: results.live.length + results.events.length + results.vod.length
      },
      ...results
    });
  } catch (err) {
    logger.error(`Error en búsqueda global: ${err.message}`);
    res.status(500).json({ error: 'Error realizando la búsqueda global' });
  }
});

export default router;
