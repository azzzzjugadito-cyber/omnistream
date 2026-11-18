import express from 'express';
import { handleStreamProxy } from '../proxy.js';

const router = express.Router();

/**
 * GET /api/proxy/stream?url=...&ref=...&ua=...
 * Proxy inverso para transmisiones de vídeo (HLS .m3u8, .ts, MP4, MKV)
 * Inyecta Referer y User-Agent por fuente y resuelve CORS y Range requests.
 */
router.all('/stream', handleStreamProxy);

export default router;
