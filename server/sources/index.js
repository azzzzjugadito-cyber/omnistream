import fs from 'fs';
import { load as yamlLoad } from 'js-yaml';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { dbService } from '../db.js';
import { IptvOrgAdapter } from './IptvOrgAdapter.js';
import { TdtChannelsAdapter } from './TdtChannelsAdapter.js';
import { SportsEventAdapter } from './SportsEventAdapter.js';
import { CinemetaVodAdapter } from './CinemetaVodAdapter.js';
import { StremioResolverAdapter } from './StremioResolverAdapter.js';
import { CustomM3uAdapter } from './CustomM3uAdapter.js';
import { XtreamAdapter } from './XtreamAdapter.js';
import { footballClassifier } from '../footballClassifier.js';
import { broadcastEngine } from '../broadcastEngine.js';

class SourceManager {
  constructor() {
    this.adapters = new Map();
    this.sourcesConfig = [];
  }

  async loadFromYaml() {
    try {
      if (!fs.existsSync(config.sourcesFile)) {
        logger.error(`Archivo sources.yaml no encontrado en: ${config.sourcesFile}`);
        return;
      }

      const fileContent = fs.readFileSync(config.sourcesFile, 'utf8');
      const parsed = yamlLoad(fileContent);

      if (!parsed || !Array.isArray(parsed.sources)) {
        logger.warn('sources.yaml no contiene una lista válida de fuentes');
        return;
      }

      this.sourcesConfig = parsed.sources;
      const newAdapters = new Map();

      for (const src of this.sourcesConfig) {
        if (!src.enabled) {
          logger.info(`Fuente desactivada en config: ${src.id}`);
          continue;
        }

        let adapter = null;
        switch (src.type) {
          case 'm3u':
            adapter = new IptvOrgAdapter(src);
            break;
          case 'tdtchannels':
            adapter = new TdtChannelsAdapter(src);
            break;
          case 'sports_events':
            adapter = new SportsEventAdapter(src);
            break;
          case 'vod_cinemeta':
            adapter = new CinemetaVodAdapter(src);
            break;
          case 'stremio_resolver':
            adapter = new StremioResolverAdapter(src);
            break;
          case 'xtream':
            adapter = new XtreamAdapter(src);
            break;
          case 'custom':
          default:
            adapter = new CustomM3uAdapter(src);
            break;
        }

        if (adapter) {
          newAdapters.set(src.id, adapter);
          // Inicializar en segundo plano sin bloquear el arranque
          adapter.init().catch(err => {
            logger.warn(`Error inicializando adaptador ${src.id}: ${err.message}`);
          });
        }
      }

      this.adapters = newAdapters;
      logger.info(`Fuentes cargadas con éxito: ${this.adapters.size} adaptadores activos.`);
    } catch (err) {
      logger.error(`Error procesando sources.yaml: ${err.message}`);
    }
  }

  async reload() {
    logger.info('Recargando fuentes desde sources.yaml en caliente...');
    await this.loadFromYaml();
    return {
      success: true,
      activeSources: this.adapters.size,
      sources: this.getSourcesList()
    };
  }

  getSourcesList() {
    const healthRecords = dbService.getAllSourceHealth();
    const healthMap = new Map(healthRecords.map(h => [h.source_id, h]));

    return this.sourcesConfig.map(s => {
      const health = healthMap.get(s.id) || { status: 'unknown', latency_ms: null, last_checked: null };
      return {
        ...s,
        isActive: this.adapters.has(s.id),
        healthStatus: health.status,
        latencyMs: health.latency_ms,
        lastChecked: health.last_checked,
        error: health.error_message
      };
    });
  }

  getAdapter(sourceId) {
    return this.adapters.get(sourceId);
  }

  /**
   * Obtiene todos los canales en directo ordenados por prioridad y salud,
   * clasificando eventos de fútbol y deduplicando streams por nombre normalizado.
   */
  async getLiveChannels(filters = {}) {
    const allChannels = [];
    const healthMap = new Map(dbService.getAllSourceHealth().map(h => [h.source_id, h]));

    // Para clasificar correctamente todos los canales (incluidos generalistas como La 1 y canales Xtream),
    // no filtramos por deporte en cada adaptador individual si se solicita 'Fútbol' o 'football'.
    const isFootballRequest = filters.isFootball || 
      (filters.sport && (filters.sport.toLowerCase() === 'futbol' || filters.sport.toLowerCase() === 'fútbol' || filters.sport.toLowerCase() === 'football'));

    const adapterFilters = isFootballRequest ? { ...filters, sport: undefined } : filters;

    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.category !== 'live') continue;

      const health = healthMap.get(id);
      const isOffline = health && health.status === 'offline';
      
      // Degradar prioridad si la fuente está caída o con latencia alta
      const effectivePriority = (adapter.priority || 10) + (isOffline ? 100 : (health?.status === 'degraded' ? 20 : 0));

      try {
        const channels = await adapter.list(adapterFilters);
        channels.forEach(ch => {
          allChannels.push({
            ...ch,
            sourceHealth: health ? health.status : 'online',
            effectivePriority
          });
        });
      } catch (err) {
        logger.warn(`Error listando canales de ${id}: ${err.message}`);
      }
    }

    // 1. CLASIFICACIÓN DE FÚTBOL (tras la agregación y ANTES de la deduplicación)
    const classifiedChannels = allChannels.map(ch => {
      const cls = footballClassifier.classify(ch);
      return {
        ...ch,
        isFootball: cls.isFootball,
        sport: cls.isFootball ? 'football' : (ch.sport || 'General'),
        footballTier: cls.footballTier,
        competitions: cls.competitions,
        normalizedKey: cls.normalizedKey
      };
    });

    // 2. DEDUPLICACIÓN: clave = nombre normalizado
    // Conserva la entrada de mayor prioridad y acumula TODAS las URLs en backupUrls, en orden de prioridad.
    classifiedChannels.sort((a, b) => a.effectivePriority - b.effectivePriority);

    const deduplicatedMap = new Map();
    for (const ch of classifiedChannels) {
      const key = ch.normalizedKey || ch.title.toLowerCase().trim();
      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, {
          ...ch,
          backupUrls: Array.isArray(ch.backupUrls) ? [...ch.backupUrls] : []
        });
      } else {
        const primary = deduplicatedMap.get(key);
        // Acumular la streamUrl en backupUrls si es distinta a la principal y no está presente
        if (ch.streamUrl && ch.streamUrl !== primary.streamUrl && !primary.backupUrls.includes(ch.streamUrl)) {
          primary.backupUrls.push(ch.streamUrl);
        }
        // Acumular las backupUrls adicionales
        if (Array.isArray(ch.backupUrls)) {
          for (const bUrl of ch.backupUrls) {
            if (bUrl && bUrl !== primary.streamUrl && !primary.backupUrls.includes(bUrl)) {
              primary.backupUrls.push(bUrl);
            }
          }
        }
        // Combinar competiciones si hay nuevas
        if (Array.isArray(ch.competitions)) {
          for (const comp of ch.competitions) {
            if (!primary.competitions.includes(comp)) {
              primary.competitions.push(comp);
            }
          }
        }
      }
    }

    let finalChannels = Array.from(deduplicatedMap.values());

    // Filtrar por Fútbol si se solicita
    if (isFootballRequest) {
      finalChannels = finalChannels.filter(c => c.isFootball);
      // Orden por footballTier (Tier 1 primero, luego Tier 2) y luego por prioridad
      finalChannels.sort((a, b) => {
        const tierA = a.footballTier || 99;
        const tierB = b.footballTier || 99;
        if (tierA !== tierB) return tierA - tierB;
        return a.effectivePriority - b.effectivePriority;
      });
    } else if (filters.sport && filters.sport !== 'Todos') {
      finalChannels = finalChannels.filter(c => c.sport && c.sport.toLowerCase() === filters.sport.toLowerCase());
    }

    // Filtrar por competición
    if (filters.competition && filters.competition !== 'Todas') {
      finalChannels = finalChannels.filter(c => 
        Array.isArray(c.competitions) && c.competitions.some(comp => comp.toLowerCase() === filters.competition.toLowerCase())
      );
    }

    // Filtrar por país si se solicitó en el nivel superior
    if (filters.country && filters.country !== 'Todos') {
      finalChannels = finalChannels.filter(c => c.country && c.country.toLowerCase() === filters.country.toLowerCase());
    }

    // Filtrar por query si se solicitó
    if (filters.query) {
      const q = filters.query.toLowerCase();
      finalChannels = finalChannels.filter(c => 
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.normalizedKey && c.normalizedKey.includes(q)) ||
        (c.competitions && c.competitions.some(comp => comp.toLowerCase().includes(q)))
      );
    }

    if (filters.limit) {
      finalChannels = finalChannels.slice(0, filters.limit);
    }

    return finalChannels;
  }

  getEpgPrograms(sourceId, channelId) {
    const adapter = this.adapters.get(sourceId);
    if (!adapter) return [];
    if (typeof adapter.getEpgPrograms === 'function') {
      return adapter.getEpgPrograms(channelId);
    }
    return [];
  }

  /**
   * Obtiene la agenda de partidos y eventos deportivos, calculando
   * en memoria la entidad Broadcast (fixture → canal → streams[])
   * y detectando el estado de emisión en directo según EPG.
   */
  async getSportsEvents(filters = {}) {
    let rawEvents = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.type === 'sports_events') {
        rawEvents = await adapter.list(filters);
        break;
      }
    }

    if (rawEvents.length === 0) return [];

    // 1. Obtener canales en directo para calcular los enlaces de emisión (broadcasts)
    const liveChannels = await this.getLiveChannels({ onlySports: true });

    // 2. Vincular broadcasts a cada fixture con deducción de idioma y verificación EPG
    const prefLang = filters.lang || 'es';
    const enhancedEvents = rawEvents.map(event => {
      return broadcastEngine.enrichFixture(
        event,
        liveChannels,
        prefLang,
        (sourceId, chId) => this.getEpgPrograms(sourceId, chId)
      );
    });

    return enhancedEvents;
  }

  /**
   * Obtiene el catálogo de cine y series bajo demanda.
   */
  async getVodCatalog(filters = {}) {
    for (const adapter of this.adapters.values()) {
      if (adapter.category === 'vod' && adapter.type === 'vod_cinemeta') {
        return adapter.list(filters);
      }
    }
    return [];
  }

  /**
   * Obtiene detalles de un elemento VOD (cast, tráiler, sinopsis).
   */
  async getVodDetails(id) {
    for (const adapter of this.adapters.values()) {
      if (adapter.category === 'vod' && adapter.type === 'vod_cinemeta') {
        return adapter.getDetails(id);
      }
    }
    return null;
  }

  /**
   * Resuelve opciones de reproducción para un título VOD.
   */
  async resolveVodStreams(imdbId, title) {
    for (const adapter of this.adapters.values()) {
      if (adapter.type === 'stremio_resolver') {
        return adapter.resolveStreamsForTitle(imdbId, title);
      }
    }
    return [];
  }

  /**
   * Búsqueda Global Unificada: devuelve simultáneamente canales en directo,
   * eventos deportivos y títulos bajo demanda clasificados por tipo.
   */
  async globalSearch(query) {
    if (!query) return { live: [], events: [], vod: [] };

    const [live, events, vod] = await Promise.all([
      this.getLiveChannels({ query }),
      this.getSportsEvents({ query }),
      (async () => {
        for (const adapter of this.adapters.values()) {
          if (adapter.category === 'vod' && adapter.type === 'vod_cinemeta') {
            return adapter.search(query);
          }
        }
        return [];
      })()
    ]);

    return {
      live: live.slice(0, 20),
      events: events.slice(0, 10),
      vod: vod.slice(0, 20)
    };
  }
}

export const sourceManager = new SourceManager();
