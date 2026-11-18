import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { formatCountryName } from './sources/IptvOrgAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'football_channels.json');

/**
 * Normalizador de nombres de canales reutilizable:
 * - Convierte a minúsculas
 * - Elimina acentos y diacríticos
 * - Elimina etiquetas y sufijos de calidad/códec (hd, fhd, uhd, 4k, 8k, 1080p, 720p, hevc, raw, backup, vip, etc.)
 * - Elimina prefijos de país (es:, uk:, [es], |es|, etc.)
 * - Normaliza operadores y numeración final duplicada
 */
export function normalizeChannelName(rawName = '') {
  if (!rawName || typeof rawName !== 'string') return '';

  let name = rawName.toLowerCase();

  // 1. Quitar acentos y diacríticos
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Quitar etiquetas completas entre corchetes o paréntesis
  name = name.replace(/\[[^\]]*\]/g, ' ');
  name = name.replace(/\((?:fhd|uhd|hd|sd|4k|8k|hevc|backup(?:\s*\d+)?|mirror(?:\s*\d+)?|respaldo(?:\s*\d+)?|reserva(?:\s*\d+)?|bk(?:\s*\d+)?|raw|vip|1080p|720p|576p|480p|360p|240p|50fps|60fps|\d+p|\d+fps)\)/gi, ' ');

  // 3. Quitar prefijos de país comunes
  name = name.replace(/^[a-z]{2,3}\s*[:|\-\/]\s*/g, ' ');
  name = name.replace(/^(?:es|esp|uk|gb|usa|us|de|fr|it|pt|nl|tr|gr|ru|pl|ar|mx|sa)\s*\|\s*/g, ' ');

  // 4. Quitar sufijos/tokens de calidad, códec o servidor
  name = name.replace(/\b(fhd|uhd|hd|sd|4k|8k|1080p|720p|576p|480p|360p|240p|50fps|60fps|\d+fps|\d+p|hevc|h264|h265|raw|backup|mirror|respaldo|reserva|bk|vip|multi|feed|directo|live|stream|ott)(?:\s*\d+)?\b/gi, ' ');

  // 5. Normalizar Plus y operadores
  name = name.replace(/plus\s*\+/gi, 'plus');
  name = name.replace(/\+/g, ' plus ');

  // 6. Eliminar caracteres especiales no alfanuméricos
  name = name.replace(/[^a-z0-9]/g, ' ');

  // 7. Colapsar espacios múltiples
  name = name.replace(/\s+/g, ' ').trim();

  // 8. Quitar número duplicado final si es un sufijo de mirror (ej: "dazn 1 1" -> "dazn 1")
  const trailingDuplicate = name.match(/^(.+\b\d+)\s+\d+$/);
  if (trailingDuplicate) {
    name = trailingDuplicate[1];
  }

  return name;
}

class FootballClassificationEngine {
  constructor() {
    this.tvgMap = new Map();
    this.nameMap = new Map();
    this.loaded = false;
    this.loadData();
  }

  loadData() {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        logger.warn(`No se encontró el fichero de canales de fútbol en ${DATA_FILE}`);
        return;
      }
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const list = parsed.channels || [];

      this.tvgMap.clear();
      this.nameMap.clear();

      for (const item of list) {
        if (Array.isArray(item.tvgIds)) {
          for (const tvg of item.tvgIds) {
            this.tvgMap.set(tvg.toLowerCase().trim(), item);
          }
        }
        if (Array.isArray(item.names)) {
          for (const n of item.names) {
            const norm = normalizeChannelName(n);
            if (norm) {
              this.nameMap.set(norm, item);
            }
          }
        }
      }

      this.loaded = true;
      logger.info(`Motor de clasificación de fútbol cargado: ${list.length} definiciones (${this.tvgMap.size} tvgIds, ${this.nameMap.size} nombres indexados).`);
    } catch (err) {
      logger.error(`Error cargando football_channels.json: ${err.message}`);
    }
  }

  /**
   * Clasifica un canal comprobando:
   * 1. tvg-id (máxima precisión)
   * 2. Nombre normalizado
   * 3. Detección heurística de deporte (reutilizando patrones de fútbol)
   */
  classify(channel) {
    if (!this.loaded) this.loadData();

    const tvgId = (channel.tvgId || channel.epgChannelId || '').toLowerCase().trim();
    const normalizedKey = normalizeChannelName(channel.title);
    const channelCountryLower = (channel.country || '').toLowerCase();
    const channelTitleLower = (channel.title || '').toLowerCase();

    const resolveClassifiedCountry = (mCountry, chCountry) => {
      const c1 = formatCountryName(mCountry);
      if (c1 && c1.toLowerCase() !== 'internacional') return c1;
      const c2 = formatCountryName(chCountry);
      if (c2 && c2.toLowerCase() !== 'internacional') return c2;
      return 'Internacional';
    };

    // 1. Cruce por tvg-id
    if (tvgId && this.tvgMap.has(tvgId)) {
      const match = this.tvgMap.get(tvgId);
      return {
        isFootball: true,
        sport: 'football',
        footballTier: match.tier,
        competitions: match.competitions || [],
        country: resolveClassifiedCountry(match.country, channel.country),
        normalizedKey
      };
    }

    // 2. Cruce por nombre normalizado exacto
    if (normalizedKey && this.nameMap.has(normalizedKey)) {
      const match = this.nameMap.get(normalizedKey);
      return {
        isFootball: true,
        sport: 'football',
        footballTier: match.tier,
        competitions: match.competitions || [],
        country: resolveClassifiedCountry(match.country, channel.country),
        normalizedKey
      };
    }

    // 3. Cruce rápido por prefijo y sufijo (tokens de palabras O(1))
    if (normalizedKey) {
      const words = normalizedKey.split(' ');
      const candidates = [];

      // Probar prefijos de mayor a menor especificidad (ej: "espn 2", luego "espn")
      for (let i = words.length - 1; i >= 1; i--) {
        const prefix = words.slice(0, i).join(' ');
        if (this.nameMap.has(prefix)) {
          const remainder = words.slice(i).join(' ');
          if (!/^\d/.test(remainder)) {
            candidates.push(this.nameMap.get(prefix));
          }
        }
      }

      // Probar sufijos (ej: "select" en "ziggo sport select")
      for (let i = 1; i < words.length; i++) {
        const suffix = words.slice(i).join(' ');
        if (this.nameMap.has(suffix)) {
          candidates.push(this.nameMap.get(suffix));
        }
      }

      if (candidates.length > 0) {
        // Priorizar concordancia de país si está disponible
        for (const match of candidates) {
          const matchCountry = (match.country || '').toLowerCase();
          const isCountryMatch = (matchCountry && (
            channelCountryLower.includes(matchCountry) ||
            (matchCountry === 'nl' && (channelCountryLower.includes('bajos') || channelTitleLower.includes('netherlands') || channelTitleLower.includes('holanda'))) ||
            (matchCountry === 'br' && (channelCountryLower.includes('brasil') || channelTitleLower.includes('brazil'))) ||
            (matchCountry === 'usa' && (channelCountryLower.includes('estados unidos') || channelTitleLower.includes('united states') || channelTitleLower.includes('usa'))) ||
            (matchCountry === 'es' && (channelCountryLower.includes('españa') || channelTitleLower.includes('spain'))) ||
            (matchCountry === 'uk' && (channelCountryLower.includes('reino unido') || channelCountryLower.includes('uk') || channelTitleLower.includes('england')))
          ));

          if (isCountryMatch) {
            return {
              isFootball: true,
              sport: 'football',
              footballTier: match.tier,
              competitions: match.competitions || [],
              country: resolveClassifiedCountry(match.country, channel.country),
              normalizedKey
            };
          }
        }

        // Si ninguno coincide en país, elegir el primer candidato
        const best = candidates[0];
        return {
          isFootball: true,
          sport: 'football',
          footballTier: best.tier,
          competitions: best.competitions || [],
          country: resolveClassifiedCountry(best.country, channel.country),
          normalizedKey
        };
      }
    }

    // 4. Reutilización de detección de deporte si el canal ya venía como Fútbol o sus metadatos lo indican
    const text = `${channel.title || ''} ${channel.category || ''}`.toLowerCase();
    const isDetectedAsFootball = channel.sport === 'Fútbol' || 
                                 channel.sport === 'football' || 
                                 /futbol|football|soccer|champions|\blaliga\b|\bpremier\b|\bserie a\b|\bcalcio\b|\bbundesliga\b|\buefa\b|\bconmebol\b/.test(text);

    if (isDetectedAsFootball) {
      // Diferenciar canales generalistas que emiten fútbol ocasional (Tier 2) vs canales de fútbol puro (Tier 1)
      const isGeneralist = /\b(la 1|tve|la 2|antena 3|cuatro|telecinco|bbc|itv|channel 4|rai|canale 5|tf1|france|das erste|ard|zdf|rtp|sbs|abc|cbs|nbc)\b/.test(normalizedKey);
      return {
        isFootball: true,
        sport: 'football',
        footballTier: isGeneralist ? 2 : 1,
        competitions: [],
        normalizedKey
      };
    }

    return {
      isFootball: false,
      sport: channel.sport || 'General',
      footballTier: null,
      competitions: [],
      normalizedKey: normalizedKey || channel.title.toLowerCase().trim()
    };
  }
}

export const footballClassifier = new FootballClassificationEngine();
