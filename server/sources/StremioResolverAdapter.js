import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../logger.js';

// Catálogo de películas de dominio público y demos abiertas verificadas con HTTP 200
const OPEN_VOD_FALLBACKS = [
  {
    title: 'Big Buck Bunny (1080p Surround)',
    quality: '1080p',
    streamUrl: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    format: 'mp4'
  },
  {
    title: 'Sintel (CGI Short Film)',
    quality: '1080p',
    streamUrl: 'https://archive.org/download/Sintel/sintel-2048-surround.mp4',
    format: 'mp4'
  },
  {
    title: 'Elephants Dream (Open Movie)',
    quality: '720p',
    streamUrl: 'https://dn600306.us.archive.org/0/items/ElephantsDream/ed_1024_512kb.mp4',
    format: 'mp4'
  },
  {
    title: 'Mux HLS Adaptive Test Stream',
    quality: 'Auto HLS (Multi-bitrate)',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    format: 'hls'
  }
];

export class StremioResolverAdapter extends BaseAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.type = 'stremio_resolver';
    this.category = 'vod';
    this.torrentioBase = 'https://torrentio.strem.fun';
  }

  /**
   * Resuelve fuentes y calidades para una película o serie dada su IMDB ID.
   */
  async resolveStreamsForTitle(imdbId, title = '') {
    const streams = [];

    // 1. Intentar resolver vía Torrentio Addon Protocol si hay IMDB ID
    if (imdbId && imdbId.startsWith('tt')) {
      const endpoints = [
        `${this.torrentioBase}/stream/series/${imdbId}:1:1.json`,
        `${this.torrentioBase}/stream/movie/${imdbId}.json`
      ];

      for (const url of endpoints) {
        try {
          logger.info(`Consultando Torrentio para ${imdbId}: ${url}`);
          const res = await axios.get(url, { timeout: 6000 });

          if (res.data && Array.isArray(res.data.streams) && res.data.streams.length > 0) {
            for (const s of res.data.streams.slice(0, 5)) {
              streams.push({
                id: `stream_${s.infoHash || Math.random().toString(36).substring(7)}`,
                name: s.name ? s.name.replace('\n', ' - ') : 'Torrentio Stream',
                title: s.title || title,
                quality: this.extractQuality(s.name || s.title),
                infoHash: s.infoHash,
                fileIdx: s.fileIdx,
                streamUrl: s.url || null,
                isP2P: !s.url,
                type: s.url && s.url.includes('.m3u8') ? 'hls' : 'mp4'
              });
            }
            break; // Si encontramos streams, detenemos la búsqueda
          }
        } catch (err) {
          logger.debug(`No se pudieron obtener streams de Torrentio para ${imdbId}: ${err.message}`);
        }
      }
    }

    // 2. Incorporar las fuentes abiertas como respaldo garantizado
    OPEN_VOD_FALLBACKS.forEach((fallback, idx) => {
      streams.push({
        id: `open_vod_${idx}`,
        name: `Servidor Público - ${fallback.title}`,
        title: `${title || 'Título'} [${fallback.quality}]`,
        quality: fallback.quality,
        streamUrl: fallback.streamUrl,
        proxiedUrl: this.getProxiedUrl(fallback.streamUrl, {}),
        isP2P: false,
        type: fallback.format
      });
    });

    return streams;
  }

  extractQuality(text = '') {
    if (text.includes('4k') || text.includes('2160p')) return '4K Ultra HD';
    if (text.includes('1080p')) return '1080p Full HD';
    if (text.includes('720p')) return '720p HD';
    if (text.includes('480p')) return '480p SD';
    return 'HD';
  }

  async list() {
    return [];
  }
}
