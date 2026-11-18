import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { parseM3u } from '../m3uParser.js';
import { logger } from '../logger.js';

export class TdtChannelsAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.type = 'tdtchannels';
    this.epgUrl = config.epgUrl || 'https://www.tdtchannels.com/epg/TV.xml.gz';
  }

  async init() {
    return this.refreshCache();
  }

  async refreshCache() {
    if (!this.url) return [];
    try {
      logger.info(`Cargando lista TDTChannels desde: ${this.url}`);
      const res = await axios.get(this.url, {
        headers: this.headers,
        timeout: 12000
      });

      const parsed = parseM3u(res.data, 'General');
      
      // Mapear canales y añadir streams de respaldo si existen canales homónimos
      const channelMap = new Map();

      for (const ch of parsed) {
        const cleanName = ch.name.replace(/\s*(GEO|CAT|ES|1080p|720p|HD|SD)\s*/gi, '').trim();
        const sport = this.detectSport(ch.name, ch.category);

        if (!channelMap.has(cleanName)) {
          channelMap.set(cleanName, {
            id: `${this.id}::${ch.id}`,
            sourceId: this.id,
            title: ch.name,
            type: 'live',
            category: ch.category || 'General',
            sport,
            country: 'España',
            logo: ch.logo || 'https://www.tdtchannels.com/img/icon.png',
            streamUrl: ch.url,
            backupUrls: [],
            headers: { ...this.headers, ...ch.headers },
            priority: this.priority
          });
        } else {
          // Si ya existe, guardamos este stream como enlace de respaldo
          const existing = channelMap.get(cleanName);
          if (ch.url !== existing.streamUrl && !existing.backupUrls.includes(ch.url)) {
            existing.backupUrls.push(ch.url);
          }
        }
      }

      this.cachedItems = Array.from(channelMap.values());
      this.lastFetched = Date.now();
      logger.info(`TDTChannels procesado: ${this.cachedItems.length} canales consolidados.`);
      return this.cachedItems;
    } catch (err) {
      logger.error(`Error cargando TDTChannels: ${err.message}`);
      return this.cachedItems;
    }
  }

  detectSport(title = '', category = '') {
    const text = `${title} ${category}`.toLowerCase();
    if (text.includes('teledeporte') || text.includes('tdp') || text.includes('esport3') || 
        text.includes('real madrid') || text.includes('gol') || text.includes('barça') || 
        text.includes('sevilla') || text.includes('betis') || text.includes('deport') || 
        text.includes('futsal') || text.includes('kirolak')) {
      if (text.includes('madrid') || text.includes('barça') || text.includes('gol') || text.includes('futbol') || text.includes('sevilla') || text.includes('betis')) {
        return 'Fútbol';
      }
      return 'Deportes';
    }
    return 'General';
  }

  async list(filters = {}) {
    if (Date.now() - this.lastFetched > this.cacheTtlMs || this.cachedItems.length === 0) {
      await this.refreshCache();
    }

    let items = [...this.cachedItems];

    if (filters.onlySports) {
      items = items.filter(it => it.sport !== 'General');
    }

    if (filters.sport && filters.sport !== 'Todos') {
      items = items.filter(it => it.sport.toLowerCase() === filters.sport.toLowerCase());
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(it => it.title.toLowerCase().includes(q));
    }

    return items;
  }
}
