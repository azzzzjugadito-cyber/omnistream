import axios from 'axios';
import fs from 'fs';
import { BaseAdapter } from './BaseAdapter.js';
import { parseM3u } from '../m3uParser.js';
import { logger } from '../logger.js';

export class CustomM3uAdapter extends BaseAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.type = 'custom';
  }

  async init() {
    return this.refreshCache();
  }

  async refreshCache() {
    if (!this.url) {
      this.cachedItems = [];
      return [];
    }

    try {
      let rawM3u = '';
      if (this.url.startsWith('http://') || this.url.startsWith('https://')) {
        const res = await axios.get(this.url, { headers: this.headers, timeout: 10000 });
        rawM3u = res.data;
      } else if (fs.existsSync(this.url)) {
        rawM3u = fs.readFileSync(this.url, 'utf8');
      }

      const parsed = parseM3u(rawM3u, 'Personalizado');
      this.cachedItems = parsed.map(ch => ({
        id: `${this.id}::${ch.id}`,
        sourceId: this.id,
        title: ch.name,
        type: 'live',
        category: ch.category || 'Personalizado',
        sport: 'Deportes',
        country: 'Personalizado',
        logo: ch.logo || 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=400&q=80',
        streamUrl: ch.url,
        backupUrls: [],
        headers: { ...this.headers, ...ch.headers },
        priority: this.priority
      }));

      this.lastFetched = Date.now();
      return this.cachedItems;
    } catch (err) {
      logger.warn(`No se pudo cargar la fuente personalizada ${this.id}: ${err.message}`);
      return [];
    }
  }

  async list(filters = {}) {
    if (this.cachedItems.length === 0 && this.url) {
      await this.refreshCache();
    }
    return this.cachedItems;
  }
}
