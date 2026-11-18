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
   * Obtiene todos los canales en directo ordenados por prioridad y salud.
   */
  async getLiveChannels(filters = {}) {
    const allChannels = [];
    const healthMap = new Map(dbService.getAllSourceHealth().map(h => [h.source_id, h]));

    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.category !== 'live') continue;

      const health = healthMap.get(id);
      const isOffline = health && health.status === 'offline';
      
      // Degradar prioridad si la fuente está caída o con latencia alta
      const effectivePriority = (adapter.priority || 10) + (isOffline ? 100 : (health?.status === 'degraded' ? 20 : 0));

      try {
        const channels = await adapter.list(filters);
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

    // Ordenar por prioridad efectiva (menor número = antes)
    allChannels.sort((a, b) => a.effectivePriority - b.effectivePriority);
    return allChannels;
  }

  /**
   * Obtiene la agenda de partidos y eventos deportivos.
   */
  async getSportsEvents(filters = {}) {
    for (const adapter of this.adapters.values()) {
      if (adapter.type === 'sports_events') {
        return adapter.list(filters);
      }
    }
    return [];
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
