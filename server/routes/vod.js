import express from 'express';
import { sourceManager } from '../sources/index.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * GET /api/vod/catalog
 * Obtiene el catálogo de cine y series bajo demanda
 */
router.get('/catalog', async (req, res) => {
  try {
    const filters = {
      contentType: req.query.type, // 'movie' | 'series'
      genre: req.query.genre,
      query: req.query.q || req.query.query
    };

    const items = await sourceManager.getVodCatalog(filters);
    res.json({
      count: items.length,
      items
    });
  } catch (err) {
    logger.error(`Error en GET /api/vod/catalog: ${err.message}`);
    res.status(500).json({ error: 'Error al obtener catálogo VOD' });
  }
});

/**
 * GET /api/vod/details/:id
 * Obtiene ficha técnica completa (sinopsis, reparto, director, tráiler, episodios)
 */
router.get('/details/:id', async (req, res) => {
  try {
    const isSeries = req.query.type === 'series' || req.query.isSeries === 'true';
    const item = await sourceManager.getVodDetails(req.params.id, { isSeries });
    if (!item) {
      return res.status(404).json({ error: 'Título no encontrado' });
    }
    res.json(item);
  } catch (err) {
    logger.error(`Error en GET /api/vod/details/${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Error obteniendo detalles' });
  }
});

/**
 * GET /api/vod/resolve/:id
 * Resuelve las opciones de stream para una película o episodio de serie
 */
router.get('/resolve/:id', async (req, res) => {
  try {
    const cleanId = req.params.id.replace('vod::', '');
    const title = req.query.title || '';
    const season = parseInt(req.query.season || req.query.s || '1', 10);
    const episode = parseInt(req.query.episode || req.query.e || '1', 10);
    const contentType = req.query.type || (req.query.season ? 'series' : 'movie');
    const isSeries = contentType === 'series';

    const streams = await sourceManager.resolveVodStreams(cleanId, title, {
      season,
      episode,
      contentType,
      isSeries
    });
    res.json({
      title,
      imdbId: cleanId,
      season,
      episode,
      contentType,
      streams
    });
  } catch (err) {
    logger.error(`Error resolviendo streams VOD: ${err.message}`);
    res.status(500).json({ error: 'Error al resolver stream VOD' });
  }
});

export default router;
