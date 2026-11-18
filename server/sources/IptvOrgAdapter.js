import axios from 'axios';
import fs from 'fs';
import { BaseAdapter } from './BaseAdapter.js';
import { parseM3u } from '../m3uParser.js';
import { logger } from '../logger.js';

const COUNTRY_MAP = {
  'es': 'España',
  'spain': 'España',
  'uk': 'Reino Unido',
  'gb': 'Reino Unido',
  'england': 'Reino Unido',
  'us': 'Estados Unidos',
  'usa': 'Estados Unidos',
  'united states': 'Estados Unidos',
  'de': 'Alemania',
  'germany': 'Alemania',
  'fr': 'Francia',
  'france': 'Francia',
  'it': 'Italia',
  'italy': 'Italia',
  'pt': 'Portugal',
  'nl': 'Países Bajos',
  'netherlands': 'Países Bajos',
  'br': 'Brasil',
  'brazil': 'Brasil',
  'ar': 'Argentina',
  'mx': 'México',
  'mexico': 'México',
  'sa': 'Arabia Saudí',
  'ksa': 'Arabia Saudí',
  'eg': 'Egipto',
  'egypt': 'Egipto',
  'za': 'Sudáfrica',
  'south africa': 'Sudáfrica',
  'in': 'India',
  'au': 'Australia',
  'gr': 'Grecia',
  'greece': 'Grecia',
  'tr': 'Turquía',
  'turkey': 'Turquía',
  'ru': 'Rusia',
  'russia': 'Rusia',
  'pl': 'Polonia',
  'poland': 'Polonia',
  'ma': 'Marruecos',
  'morocco': 'Marruecos',
  'cl': 'Chile',
  'co': 'Colombia'
};

export function formatCountryName(c = '') {
  if (!c || typeof c !== 'string') return '';
  const key = c.toLowerCase().trim();
  return COUNTRY_MAP[key] || c;
}

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
      let rawData = '';
      if (this.url.startsWith('http://') || this.url.startsWith('https://')) {
        const res = await axios.get(this.url, {
          headers: this.headers,
          timeout: 12000
        });
        rawData = res.data;
      } else if (fs.existsSync(this.url)) {
        rawData = fs.readFileSync(this.url, 'utf8');
      }

      const parsed = parseM3u(rawData, 'Deportes');
      this.cachedItems = parsed.map(ch => {
        const country = this.resolveCountry(ch.country, ch.name, ch.tvgId);
        return {
          id: `${this.id}::${ch.id}`,
          sourceId: this.id,
          title: ch.name,
          type: 'live',
          category: ch.category || 'Deportes',
          sport: this.detectSport(ch.name, ch.category),
          country: country,
          logo: ch.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
          streamUrl: ch.url,
          backupUrls: [],
          headers: { ...this.headers, ...ch.headers },
          priority: this.priority
        };
      });

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

  resolveCountry(chCountry = '', title = '', tvgId = '') {
    if (chCountry) {
      const formatted = formatCountryName(chCountry);
      if (formatted && formatted.toLowerCase() !== 'internacional') return formatted;
    }

    if (tvgId && tvgId.includes('.')) {
      const parts = tvgId.split('.');
      const suffix = parts[parts.length - 1].toLowerCase();
      if (COUNTRY_MAP[suffix]) return COUNTRY_MAP[suffix];
    }

    return this.detectCountry(title);
  }

  detectCountry(title = '') {
    const t = title.toLowerCase();
    if (t.includes('.es') || t.includes('(es)') || t.includes('(spain)') || t.includes('spain') || t.includes('españa')) return 'España';
    if (t.includes('.uk') || t.includes('(uk)') || t.includes('(united kingdom)') || t.includes('england') || t.includes('britain')) return 'Reino Unido';
    if (t.includes('.us') || t.includes('(us)') || t.includes('(usa)') || t.includes('(united states)') || t.includes('united states')) return 'Estados Unidos';
    if (t.includes('.it') || t.includes('(it)') || t.includes('(italy)') || t.includes('italy') || t.includes('italia')) return 'Italia';
    if (t.includes('.de') || t.includes('(de)') || t.includes('(germany)') || t.includes('germany') || t.includes('alemania')) return 'Alemania';
    if (t.includes('.fr') || t.includes('(fr)') || t.includes('(france)') || t.includes('france') || t.includes('francia')) return 'Francia';
    if (t.includes('.pt') || t.includes('(pt)') || t.includes('(portugal)') || t.includes('portugal')) return 'Portugal';
    if (t.includes('.nl') || t.includes('(nl)') || t.includes('(netherlands)') || t.includes('netherlands') || t.includes('holanda') || t.includes('dutch')) return 'Países Bajos';
    if (t.includes('.br') || t.includes('(br)') || t.includes('(brazil)') || t.includes('(brasil)') || t.includes('brazil') || t.includes('brasil')) return 'Brasil';
    if (t.includes('.ar') || t.includes('(ar)') || t.includes('(argentina)') || t.includes('argentina')) return 'Argentina';
    if (t.includes('.mx') || t.includes('(mx)') || t.includes('(mexico)') || t.includes('mexico') || t.includes('méxico')) return 'México';
    if (t.includes('.sa') || t.includes('(sa)') || t.includes('saudi')) return 'Arabia Saudí';
    if (t.includes('.eg') || t.includes('(eg)') || t.includes('egypt')) return 'Egipto';
    if (t.includes('.za') || t.includes('(za)') || t.includes('south africa')) return 'Sudáfrica';
    if (t.includes('.in') || t.includes('(in)') || t.includes('india')) return 'India';
    if (t.includes('.au') || t.includes('(au)') || t.includes('australia')) return 'Australia';
    if (t.includes('.gr') || t.includes('(gr)') || t.includes('greece') || t.includes('grecia')) return 'Grecia';
    if (t.includes('.tr') || t.includes('(tr)') || t.includes('turkey') || t.includes('turquía')) return 'Turquía';
    if (t.includes('.ru') || t.includes('(ru)') || t.includes('russia') || t.includes('rusia')) return 'Rusia';
    if (t.includes('.pl') || t.includes('(pl)') || t.includes('poland') || t.includes('polonia')) return 'Polonia';
    if (t.includes('.ma') || t.includes('(ma)') || t.includes('morocco') || t.includes('marruecos')) return 'Marruecos';
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
