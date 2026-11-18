import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { parseM3u } from '../m3uParser.js';
import { logger } from '../logger.js';

export class IptvOrgAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.type = 'm3u';
  }

  async init() {
    return this.refreshCache();
  }

  async refreshCache() {
    if (!this.url) return [];
    try {
      logger.info(`Cargando lista M3U desde: ${this.url}`);
      const res = await axios.get(this.url, {
        headers: this.headers,
        timeout: 12000
      });

      const parsed = parseM3u(res.data, 'Deportes');
      this.cachedItems = parsed.map(ch => ({
        id: `${this.id}::${ch.id}`,
        sourceId: this.id,
        title: ch.name,
        type: 'live',
        category: ch.category || 'Deportes',
        sport: this.detectSport(ch.name, ch.category),
        country: this.detectCountry(ch.name),
        logo: ch.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
        streamUrl: ch.url,
        backupUrls: [],
        headers: { ...this.headers, ...ch.headers },
        priority: this.priority
      }));

      this.lastFetched = Date.now();
      logger.info(`Fuente ${this.id} cargada con éxito: ${this.cachedItems.length} canales.`);
      return this.cachedItems;
    } catch (err) {
      logger.error(`Error cargando fuente M3U ${this.id}: ${err.message}`);
      return this.cachedItems;
    }
  }

  detectSport(title = '', category = '') {
    const text = `${title} ${category}`.toLowerCase();
    if (text.match(/ufc|fight|box|wwe|mma|combate|judo|karate/)) return 'Deportes de contacto';
    if (text.match(/f1|formula|racing|motogp|motor|auto|nascar|rally/)) return 'Motor';
    if (text.match(/basket|nba|baloncesto|euroleague/)) return 'Baloncesto';
    if (text.match(/futbol|football|soccer|liga|premier|champions|\bfc\b|calcio/)) return 'Fútbol';
    if (text.match(/tennis|tenis|atp|wta/)) return 'Tenis';
    if (text.match(/golf/)) return 'Golf';
    if (text.match(/cycling|ciclismo|tour|giro|vuelta/)) return 'Ciclismo';
    return 'Deportes';
  }

  detectCountry(title = '') {
    const t = title.toLowerCase();
    if (t.includes('.es') || t.includes('(es)') || t.includes('spain') || t.includes('españa')) return 'España';
    if (t.includes('.uk') || t.includes('england') || t.includes('britain')) return 'Reino Unido';
    if (t.includes('.us') || t.includes('usa') || t.includes('united states')) return 'Estados Unidos';
    if (t.includes('.it') || t.includes('italy') || t.includes('italia')) return 'Italia';
    if (t.includes('.de') || t.includes('germany') || t.includes('alemania')) return 'Alemania';
    if (t.includes('.fr') || t.includes('france') || t.includes('francia')) return 'Francia';
    if (t.includes('.pt') || t.includes('portugal')) return 'Portugal';
    if (t.includes('.nl') || t.includes('netherlands') || t.includes('holanda') || t.includes('dutch')) return 'Países Bajos';
    if (t.includes('.br') || t.includes('brazil') || t.includes('brasil')) return 'Brasil';
    if (t.includes('.ar') || t.includes('argentina')) return 'Argentina';
    if (t.includes('.mx') || t.includes('mexico') || t.includes('méxico')) return 'México';
    return 'Internacional';
  }

  async list(filters = {}) {
    if (Date.now() - this.lastFetched > this.cacheTtlMs || this.cachedItems.length === 0) {
      await this.refreshCache();
    }

    let items = [...this.cachedItems];

    if (filters.sport && filters.sport !== 'Todos') {
      items = items.filter(it => it.sport.toLowerCase() === filters.sport.toLowerCase());
    }

    if (filters.country && filters.country !== 'Todos') {
      items = items.filter(it => it.country.toLowerCase() === filters.country.toLowerCase());
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(it => it.title.toLowerCase().includes(q));
    }

    if (filters.limit) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }
}
