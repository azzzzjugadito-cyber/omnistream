import express from 'express';
import { dbService } from '../db.js';
import { logger } from '../logger.js';

const router = express.Router();

// Favoritos
router.get('/favorites', (req, res) => {
  try {
    const list = dbService.getFavorites();
    res.json({ favorites: list });
  } catch (err) {
    logger.error(`Error obteniendo favoritos: ${err.message}`);
    res.status(500).json({ error: 'Error al consultar favoritos' });
  }
});

router.post('/favorites', (req, res) => {
  try {
    const { itemId, type, title, poster, streamUrl, category, extraJson } = req.body;
    if (!itemId || !title) {
      return res.status(400).json({ error: 'Falta itemId o title' });
    }

    const isFav = dbService.isFavorite(itemId);
    if (isFav) {
      dbService.removeFavorite(itemId);
      return res.json({ status: 'removed', itemId });
    } else {
      dbService.addFavorite({ itemId, type, title, poster, streamUrl, category, extraJson });
      return res.json({ status: 'added', itemId });
    }
  } catch (err) {
    logger.error(`Error actualizando favorito: ${err.message}`);
    res.status(500).json({ error: 'Error al guardar favorito' });
  }
});

router.delete('/favorites/:itemId', (req, res) => {
  try {
    dbService.removeFavorite(req.params.itemId);
    res.json({ success: true, removed: req.params.itemId });
  } catch (err) {
    logger.error(`Error eliminando favorito: ${err.message}`);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

// Historial y Continuar Viendo
router.get('/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const history = dbService.getHistory(limit);
    res.json({ history });
  } catch (err) {
    logger.error(`Error obteniendo historial: ${err.message}`);
    res.status(500).json({ error: 'Error al consultar historial' });
  }
});

router.post('/history', (req, res) => {
  try {
    const { itemId, type, title, poster, streamUrl, positionSeconds, durationSeconds } = req.body;
    if (!itemId || !title) {
      return res.status(400).json({ error: 'Falta itemId o title' });
    }

    dbService.updateHistory({
      itemId,
      type: type || 'video',
      title,
      poster,
      streamUrl,
      positionSeconds: positionSeconds || 0,
      durationSeconds: durationSeconds || 0
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(`Error guardando posición en historial: ${err.message}`);
    res.status(500).json({ error: 'Error al guardar progreso' });
  }
});

router.delete('/history', (req, res) => {
  try {
    dbService.clearHistory();
    res.json({ success: true });
  } catch (err) {
    logger.error(`Error limpiando historial: ${err.message}`);
    res.status(500).json({ error: 'Error al limpiar historial' });
  }
});

export default router;
