import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Interfaz base y clase abstracta para todos los adaptadores de contenido OTT.
 * Garantiza que cada proveedor (IPTV, TDT, VOD, Eventos) implemente la misma API.
 */
export class BaseAdapter {
  constructor(config = {}) {
    this.id = config.id || 'base';
    this.name = config.name || 'Base Adapter';
    this.type = config.type || 'generic';
    this.category = config.category || 'live';
    this.url = config.url || '';
    this.headers = config.headers || {};
    this.priority = config.priority || 10;
    this.enabled = config.enabled !== false;
    this.cachedItems = [];
    this.lastFetched = 0;
    this.cacheTtlMs = 15 * 60 * 1000; // 15 minutos de caché por defecto
  }

  /**
   * Inicializa o actualiza la caché de la fuente.
   */
  async init() {
    return true;
  }

  /**
   * Devuelve la lista de elementos según filtros (categoría, límite, deporte, etc.).
   */
  async list(filters = {}) {
    throw new Error(`Método list() no implementado en adaptador ${this.id}`);
  }

  /**
   * Busca elementos por término de consulta en esta fuente.
   */
  async search(query) {
    if (!query) return [];
    const items = await this.list();
    const q = query.toLowerCase();
    return items.filter(it => 
      (it.title && it.title.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q)) ||
      (it.sport && it.sport.toLowerCase().includes(q))
    );
  }

  /**
   * Resuelve el enlace de reproducción final con sus cabeceras y streams de respaldo.
   */
  async resolveStream(itemId) {
    const items = await this.list();
    const item = items.find(it => it.id === itemId);
    if (!item) {
      throw new Error(`Elemento con ID ${itemId} no encontrado en fuente ${this.id}`);
    }

    return {
      itemId: item.id,
      title: item.title,
      streamUrl: item.streamUrl,
      proxiedUrl: this.getProxiedUrl(item.streamUrl, item.headers || this.headers),
      backupUrls: item.backupUrls || [],
      headers: item.headers || this.headers,
      type: item.type || 'hls',
      metadata: item.metadata || {}
    };
  }

  /**
   * Genera la URL del proxy interno para un stream dado.
   */
  getProxiedUrl(targetUrl, headers = {}) {
    if (!targetUrl) return '';
    const ref = headers['Referer'] || this.headers['Referer'] || '';
    const ua = headers['User-Agent'] || this.headers['User-Agent'] || '';
    return `/api/proxy/stream?url=${encodeURIComponent(targetUrl)}&ref=${encodeURIComponent(ref)}&ua=${encodeURIComponent(ua)}`;
  }

  /**
   * Comprueba la salud y latencia de la fuente enviando una petición con timeout.
   */
  async checkHealth() {
    if (!this.url) {
      return { status: 'offline', latencyMs: 0, error: 'URL no configurada' };
    }

    const start = Date.now();
    try {
      const response = await axios({
        method: 'HEAD',
        url: this.url,
        headers: this.headers,
        timeout: 8000,
        validateStatus: (s) => s < 400
      });

      const latencyMs = Date.now() - start;
      const status = latencyMs > 3500 ? 'degraded' : 'online';
      return { status, latencyMs, error: null };
    } catch (headErr) {
      // Si falla HEAD, probar con GET ligero de 1 byte (rango)
      try {
        await axios({
          method: 'GET',
          url: this.url,
          headers: { ...this.headers, Range: 'bytes=0-100' },
          timeout: 8000,
          validateStatus: (s) => s < 400
        });
        const latencyMs = Date.now() - start;
        return { status: latencyMs > 3500 ? 'degraded' : 'online', latencyMs, error: null };
      } catch (getErr) {
        const latencyMs = Date.now() - start;
        logger.warn(`Salud fallida para fuente ${this.id}: ${getErr.message}`);
        return { 
          status: 'offline', 
          latencyMs, 
          error: getErr.response ? `HTTP ${getErr.response.status}` : getErr.message 
        };
      }
    }
  }

  /**
   * Devuelve la lista de programas EPG para un canal dado si la fuente soporta EPG
   */
  getEpgPrograms(itemId) {
    return [];
  }
}
