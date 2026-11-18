import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { parseXmltv, getCurrentAndNextProgram } from '../epgParser.js';
import { logger } from '../logger.js';

export class XtreamAdapter extends BaseAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.type = 'xtream';
    this.category = 'live';

    this.host = cfg.host || '';
    this.port = cfg.port || (cfg.protocol === 'https' ? 443 : 80);
    this.protocol = cfg.protocol || 'http';

    // Interpolación de credenciales desde entorno o literales
    this.username = (cfg.usernameEnv && process.env[cfg.usernameEnv]) 
      ? process.env[cfg.usernameEnv] 
      : (cfg.username || '');

    this.password = (cfg.passwordEnv && process.env[cfg.passwordEnv]) 
      ? process.env[cfg.passwordEnv] 
      : (cfg.password || '');

    this.streamExt = cfg.streamExt || 'm3u8'; // 'm3u8' o 'ts'
    
    // EPG URL explícita o generada por convención Xtream (xmltv.php)
    this.epgUrl = cfg.epgUrl || '';
    this.epgData = new Map();
    this.epgLastFetched = 0;

    this.categoriesMap = new Map();
    this.userInfo = null;
    this.serverInfo = null;
  }

  getBaseUrl() {
    const cleanHost = this.host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const portPart = (this.port === 80 && this.protocol === 'http') || (this.port === 443 && this.protocol === 'https')
      ? ''
      : `:${this.port}`;
    return `${this.protocol}://${cleanHost}${portPart}`;
  }

  getPlayerApiUrl(action = '') {
    const base = this.getBaseUrl();
    const actionParam = action ? `&action=${encodeURIComponent(action)}` : '';
    return `${base}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}${actionParam}`;
  }

  getXmltvUrl() {
    if (this.epgUrl) return this.epgUrl;
    const base = this.getBaseUrl();
    return `${base}/xmltv.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
  }

  async init() {
    try {
      if (!this.host || !this.username) {
        logger.info(`Adaptador Xtream [${this.id}] registrado pero sin credenciales completas.`);
        this.cachedItems = [];
        return true;
      }
      await this.refreshCache();
    } catch (err) {
      // Un fallo en Xtream NUNCA debe tumbar el arranque
      logger.warn(`Adaptador Xtream [${this.id}] no accesible en el arranque (${err.message}). Degradando a lista vacía.`);
      this.cachedItems = [];
    }
    return true;
  }

  async refreshCache() {
    if (!this.host || !this.username) return [];

    try {
      logger.info(`Sincronizando proveedor Xtream [${this.id}]: ${this.host}:${this.port}...`);
      
      // 1. Autenticación y verificación
      const authRes = await axios.get(this.getPlayerApiUrl(), {
        headers: this.headers,
        timeout: 7000
      });

      if (authRes.data && authRes.data.user_info) {
        this.userInfo = authRes.data.user_info;
        this.serverInfo = authRes.data.server_info;

        if (this.userInfo.auth === 0 || this.userInfo.status === 'Disabled') {
          logger.warn(`Credenciales Xtream [${this.id}] no autorizadas o cuenta desactivada.`);
          return [];
        }
      }

      // 2. Obtener categorías de canales en directo
      try {
        const catRes = await axios.get(this.getPlayerApiUrl('get_live_categories'), {
          headers: this.headers,
          timeout: 8000
        });
        if (Array.isArray(catRes.data)) {
          this.categoriesMap.clear();
          catRes.data.forEach(c => {
            this.categoriesMap.set(String(c.category_id), c.category_name);
          });
        }
      } catch (catErr) {
        logger.debug(`No se pudieron obtener categorías para ${this.id}: ${catErr.message}`);
      }

      // 3. Obtener lista de streams en directo
      const streamsRes = await axios.get(this.getPlayerApiUrl('get_live_streams'), {
        headers: this.headers,
        timeout: 12000
      });

      if (!Array.isArray(streamsRes.data)) {
        logger.warn(`Respuesta inesperada al obtener streams de Xtream [${this.id}]`);
        return [];
      }

      const base = this.getBaseUrl();
      const ext = this.streamExt.replace(/^\./, '');
      const altExt = ext === 'm3u8' ? 'ts' : 'm3u8';

      // 4. Mapear canales a la interfaz estándar del sistema
      this.cachedItems = streamsRes.data.map(stream => {
        const streamId = stream.stream_id;
        const categoryName = this.categoriesMap.get(String(stream.category_id)) || 'En Directo';
        const rawName = stream.name || `Canal ${streamId}`;

        // Construcción estándar de URL Xtream
        const primaryUrl = `${base}/live/${this.username}/${this.password}/${streamId}.${ext}`;
        const fallbackUrl = `${base}/live/${this.username}/${this.password}/${streamId}.${altExt}`;
        const directUrl = `${base}/${this.username}/${this.password}/${streamId}`;

        const backupUrls = [];
        if (stream.direct_source) backupUrls.push(stream.direct_source);
        backupUrls.push(fallbackUrl);
        backupUrls.push(directUrl);

        return {
          id: `${this.id}::${streamId}`,
          sourceId: this.id,
          streamId,
          title: rawName,
          type: 'live',
          category: categoryName,
          sport: this.detectSport(rawName, categoryName),
          country: this.detectCountry(rawName, categoryName),
          logo: stream.stream_icon || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
          streamUrl: primaryUrl,
          backupUrls,
          epgChannelId: stream.epg_channel_id || null,
          headers: this.headers,
          priority: this.priority,
          currentProgram: null,
          nextProgram: null
        };
      });

      this.lastFetched = Date.now();
      logger.info(`Proveedor Xtream [${this.id}] sincronizado con éxito: ${this.cachedItems.length} canales en directo.`);

      // Sincronizar EPG en segundo plano sin retrasar la respuesta
      this.refreshEpg().catch(e => logger.debug(`EPG Xtream aviso: ${e.message}`));

      return this.cachedItems;
    } catch (err) {
      logger.error(`Error sincronizando Xtream [${this.id}]: ${err.message}`);
      return this.cachedItems || [];
    }
  }

  /**
   * Sincroniza la guía EPG XMLTV del proveedor si está disponible
   */
  async refreshEpg() {
    const xmltvUrl = this.getXmltvUrl();
    if (!xmltvUrl || Date.now() - this.epgLastFetched < 60 * 60 * 1000) {
      return; // 1 hora de caché para EPG
    }

    try {
      logger.info(`Descargando EPG XMLTV desde: ${xmltvUrl}`);
      const res = await axios.get(xmltvUrl, {
        headers: this.headers,
        timeout: 15000,
        responseType: 'arraybuffer'
      });

      const parsedEpg = parseXmltv(res.data);
      this.epgData = parsedEpg;
      this.epgLastFetched = Date.now();
      logger.info(`EPG XMLTV procesado: ${this.epgData.size} canales con programación.`);

      // Asociar programa actual y próximo a los canales cacheados
      const now = new Date();
      this.cachedItems.forEach(ch => {
        if (ch.epgChannelId && this.epgData.has(ch.epgChannelId)) {
          const progs = this.epgData.get(ch.epgChannelId);
          const { current, next } = getCurrentAndNextProgram(progs, now);
          ch.currentProgram = current ? current.title : null;
          ch.nextProgram = next ? next.title : null;
        }
      });
    } catch (err) {
      logger.debug(`No se pudo cargar la EPG XMLTV de ${this.id}: ${err.message}`);
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
    if (text.match(/sport|deport/)) return 'Deportes';
    return 'General';
  }

  detectCountry(title = '', category = '') {
    const t = `${title} ${category}`.toLowerCase();
    if (t.includes('.es') || t.includes('(es)') || t.includes('spain') || t.includes('españa') || t.includes('esp')) return 'España';
    if (t.includes('.uk') || t.includes('england') || t.includes('britain') || t.includes('sky')) return 'Reino Unido';
    if (t.includes('.us') || t.includes('usa') || t.includes('estados unidos')) return 'Estados Unidos';
    if (t.includes('.it') || t.includes('italy') || t.includes('italia')) return 'Italia';
    if (t.includes('.de') || t.includes('germany') || t.includes('alemania')) return 'Alemania';
    if (t.includes('.fr') || t.includes('france') || t.includes('francia')) return 'Francia';
    if (t.includes('.pt') || t.includes('portugal')) return 'Portugal';
    if (t.includes('.nl') || t.includes('netherlands') || t.includes('holanda')) return 'Países Bajos';
    if (t.includes('.ar') || t.includes('argentina')) return 'Argentina';
    if (t.includes('.mx') || t.includes('mexico') || t.includes('méxico')) return 'México';
    return 'Internacional';
  }

  async list(filters = {}) {
    if (Date.now() - this.lastFetched > this.cacheTtlMs || this.cachedItems.length === 0) {
      if (this.host && this.username) {
        await this.refreshCache();
      }
    }

    let items = [...this.cachedItems];

    if (filters.onlySports) {
      items = items.filter(it => it.sport !== 'General');
    }

    if (filters.sport && filters.sport !== 'Todos') {
      items = items.filter(it => it.sport.toLowerCase() === filters.sport.toLowerCase());
    }

    if (filters.country && filters.country !== 'Todos') {
      items = items.filter(it => it.country.toLowerCase() === filters.country.toLowerCase());
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(it => 
        it.title.toLowerCase().includes(q) || 
        (it.category && it.category.toLowerCase().includes(q))
      );
    }

    if (filters.limit) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }

  async checkHealth() {
    if (!this.host || !this.username) {
      return { status: 'offline', latencyMs: 0, error: 'Credenciales incompletas' };
    }

    const start = Date.now();
    try {
      const res = await axios.get(this.getPlayerApiUrl(), {
        headers: this.headers,
        timeout: 6000
      });

      const latencyMs = Date.now() - start;
      if (res.data && res.data.user_info) {
        const isAuth = res.data.user_info.auth === 1;
        if (!isAuth) {
          return { status: 'offline', latencyMs, error: 'Autenticación rechazada' };
        }
        return { status: latencyMs > 3500 ? 'degraded' : 'online', latencyMs, error: null };
      }

      return { status: 'degraded', latencyMs, error: 'Respuesta sin user_info' };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return { 
        status: 'offline', 
        latencyMs, 
        error: err.response ? `HTTP ${err.response.status}` : err.message 
      };
    }
  }
}
