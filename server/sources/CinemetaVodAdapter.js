import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Lista de las series más icónicas y aclamadas de Netflix con sus IDs de IMDb
const NETFLIX_FEATURED_SERIES_IDS = [
  'tt4574334',  // Stranger Things
  'tt10919420', // Squid Game (El juego del calamar)
  'tt6468322',  // La Casa de Papel (Money Heist)
  'tt13443470', // Wednesday (Miércoles)
  'tt2442560',  // Peaky Blinders
  'tt2085059',  // Black Mirror
  'tt2707408',  // Narcos
  'tt5753856',  // Dark
  'tt5180504',  // The Witcher
  'tt4786824',  // The Crown
  'tt0903747',  // Breaking Bad
  'tt3032476',  // Better Call Saul
  'tt7221388',  // Cobra Kai
  'tt11126994', // Arcane
  'tt7631058',  // Sex Education
  'tt2531336',  // Lupin
  'tt7134908',  // Élite
  'tt5071411',  // Ozark
  'tt10048342', // Gambito de Dama (The Queen's Gambit)
  'tt15486790', // Berlín
  'tt13016388', // El problema de los 3 cuerpos (3 Body Problem)
  'tt8740790',  // Los Bridgerton
  'tt11737520', // One Piece
  'tt6597800',  // You
  'tt5290382',  // Mindhunter
  'tt14403178', // Bronca (Beef)
  'tt1755576',  // Sandman
  'tt4052886',  // Lucifer
  'tt7135324',  // The Umbrella Academy
  'tt10795658', // Alice in Borderland
  'tt27771746'  // El caso Asunta
];

export class CinemetaVodAdapter extends BaseAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.type = 'vod_cinemeta';
    this.category = 'vod';
    this.cinemetaBase = 'https://v3-cinemeta.strem.io';
    this.tmdbKey = config.tmdbApiKey;
    this.tmdbBase = 'https://api.themoviedb.org/3';
  }

  async init() {
    return this.refreshCache();
  }

  async refreshCache() {
    try {
      logger.info('Cargando catálogo ampliado de Cine y Series (con catálogo Netflix)...');
      let movies = [];
      let series = [];
      let netflixHits = [];

      // 1. Obtener películas populares (Página 1 y Página 2)
      try {
        const [m1, m2] = await Promise.all([
          axios.get(`${this.cinemetaBase}/catalog/movie/top.json`, { timeout: 8000 }),
          axios.get(`${this.cinemetaBase}/catalog/movie/top/skip=100.json`, { timeout: 8000 }).catch(() => ({ data: { metas: [] } }))
        ]);
        const rawM = [...(m1.data?.metas || []), ...(m2.data?.metas || [])];
        movies = rawM.map(m => this.formatCinemetaItem(m, 'movie'));
      } catch (err) {
        logger.warn(`Aviso cargando películas Cinemeta: ${err.message}`);
      }

      // 2. Obtener series populares y series mejor valoradas (Top Rated)
      try {
        const [s1, s2, sTop] = await Promise.all([
          axios.get(`${this.cinemetaBase}/catalog/series/top.json`, { timeout: 8000 }),
          axios.get(`${this.cinemetaBase}/catalog/series/top/skip=100.json`, { timeout: 8000 }).catch(() => ({ data: { metas: [] } })),
          axios.get(`${this.cinemetaBase}/catalog/series/imdbRating.json`, { timeout: 8000 }).catch(() => ({ data: { metas: [] } }))
        ]);
        const rawS = [...(s1.data?.metas || []), ...(s2.data?.metas || []), ...(sTop.data?.metas || [])];
        series = rawS.map(s => this.formatCinemetaItem(s, 'series'));
      } catch (err) {
        logger.warn(`Aviso cargando series Cinemeta: ${err.message}`);
      }

      // 3. Cargar catálogo de Top Series de Netflix
      try {
        const netflixBatch = await Promise.all(
          NETFLIX_FEATURED_SERIES_IDS.map(async (imdbId) => {
            try {
              const res = await axios.get(`${this.cinemetaBase}/meta/series/${imdbId}.json`, { timeout: 6000 });
              if (res.data && res.data.meta) {
                const item = this.formatCinemetaItem(res.data.meta, 'series');
                item.isNetflix = true;
                item.platform = 'Netflix';
                return item;
              }
            } catch {
              // Si falla individual, continuar
            }
            return null;
          })
        );
        netflixHits = netflixBatch.filter(Boolean);
      } catch (err) {
        logger.warn(`Aviso cargando series destacadas de Netflix: ${err.message}`);
      }

      // También consultar catálogo dinámico "netflix" de Cinemeta
      try {
        const nSearch = await axios.get(`${this.cinemetaBase}/catalog/series/top/search=netflix.json`, { timeout: 6000 });
        if (nSearch.data && Array.isArray(nSearch.data.metas)) {
          const searchNetflix = nSearch.data.metas.map(m => {
            const item = this.formatCinemetaItem(m, 'series');
            item.isNetflix = true;
            item.platform = 'Netflix';
            return item;
          });
          netflixHits.push(...searchNetflix);
        }
      } catch (err) {
        // Continuar
      }

      // Consolidar títulos evitando duplicados por ID
      const titleMap = new Map();

      // Primero añadir los hits de Netflix para garantizar su presencia destacada
      netflixHits.forEach(item => titleMap.set(item.id, item));

      // Luego series generales
      series.forEach(item => {
        if (!titleMap.has(item.id)) {
          if (NETFLIX_FEATURED_SERIES_IDS.includes(item.imdbId)) {
            item.isNetflix = true;
            item.platform = 'Netflix';
          }
          titleMap.set(item.id, item);
        }
      });

      // Luego películas
      movies.forEach(item => {
        if (!titleMap.has(item.id)) {
          titleMap.set(item.id, item);
        }
      });

      this.cachedItems = Array.from(titleMap.values());
      this.lastFetched = Date.now();
      
      const seriesCount = this.cachedItems.filter(it => it.contentType === 'series').length;
      const movieCount = this.cachedItems.filter(it => it.contentType === 'movie').length;
      const netflixCount = this.cachedItems.filter(it => it.isNetflix).length;

      logger.info(`Catálogo VOD consolidado: ${this.cachedItems.length} títulos totales (${seriesCount} series, ${netflixCount} de Netflix, ${movieCount} películas).`);
      return this.cachedItems;
    } catch (err) {
      logger.error(`Error cargando catálogo VOD: ${err.message}`);
      return this.cachedItems;
    }
  }

  formatCinemetaItem(item, type) {
    const isNetflix = NETFLIX_FEATURED_SERIES_IDS.includes(item.imdb_id || item.id);

    return {
      id: `vod::${item.imdb_id || item.id}`,
      imdbId: item.imdb_id || item.id,
      sourceId: this.id,
      title: item.name,
      type: 'vod',
      contentType: type || (item.type === 'series' ? 'series' : 'movie'),
      year: item.year || item.releaseInfo || '',
      genres: item.genres || item.genre || ['Cine'],
      rating: item.imdbRating || '7.5',
      synopsis: item.description || 'Sin sinopsis disponible.',
      poster: item.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80',
      banner: item.background || item.poster,
      cast: Array.isArray(item.cast) ? item.cast : [],
      director: Array.isArray(item.director) ? item.director.join(', ') : (item.director || ''),
      trailer: item.trailer ? `https://www.youtube.com/watch?v=${item.trailer}` : null,
      isNetflix: isNetflix || !!item.isNetflix,
      platform: isNetflix || item.isNetflix ? 'Netflix' : '',
      priority: this.priority
    };
  }

  formatTmdbItem(item, type) {
    const isMovie = type === 'movie';
    const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
    const backdropPath = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : posterPath;

    return {
      id: `vod::tmdb_${item.id}`,
      tmdbId: item.id,
      imdbId: null,
      sourceId: this.id,
      title: isMovie ? item.title : item.name,
      type: 'vod',
      contentType: type,
      year: (isMovie ? item.release_date : item.first_air_date || '').substring(0, 4),
      genres: ['Cine'],
      rating: item.vote_average ? item.vote_average.toFixed(1) : '7.0',
      synopsis: item.overview || 'Sin descripción disponible.',
      poster: posterPath || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80',
      banner: backdropPath,
      cast: [],
      director: '',
      trailer: null,
      isNetflix: false,
      platform: '',
      priority: this.priority
    };
  }

  async list(filters = {}) {
    // Si se especifica una búsqueda ('query' o 'q'), consultar en VIVO sobre todo el catálogo de IMDb
    const q = (filters.query || filters.q || '').trim();
    if (q) {
      let results = await this.search(q);
      if (filters.contentType) {
        if (filters.contentType === 'netflix') {
          results = results.filter(it => it.isNetflix || it.platform === 'Netflix');
        } else {
          results = results.filter(it => it.contentType === filters.contentType);
        }
      }
      if (filters.genre && filters.genre !== 'Todos') {
        results = results.filter(it => 
          it.genres && it.genres.some(g => g.toLowerCase().includes(filters.genre.toLowerCase()))
        );
      }
      return results;
    }

    if (Date.now() - this.lastFetched > this.cacheTtlMs || this.cachedItems.length === 0) {
      await this.refreshCache();
    }

    let items = [...this.cachedItems];

    // Filtro por tipo: 'movie' | 'series' | 'netflix'
    if (filters.contentType) {
      if (filters.contentType === 'netflix') {
        items = items.filter(it => it.isNetflix || it.platform === 'Netflix');
      } else {
        items = items.filter(it => it.contentType === filters.contentType);
      }
    }

    if (filters.genre && filters.genre !== 'Todos') {
      items = items.filter(it => 
        it.genres && it.genres.some(g => g.toLowerCase().includes(filters.genre.toLowerCase()))
      );
    }

    return items;
  }

  async search(query) {
    if (!query) return [];
    const q = query.toLowerCase();

    // Primero comprobar en la caché local
    const localMatches = (this.cachedItems || []).filter(it => it.title.toLowerCase().includes(q));

    // Si hay TMDB API Key, hacer búsqueda en vivo
    if (this.tmdbKey) {
      try {
        const res = await axios.get(`${this.tmdbBase}/search/multi?api_key=${this.tmdbKey}&query=${encodeURIComponent(query)}&language=es-ES`);
        const results = (res.data.results || [])
          .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
          .map(r => this.formatTmdbItem(r, r.media_type === 'movie' ? 'movie' : 'series'));
        return results;
      } catch (err) {
        logger.debug(`Error en búsqueda TMDB: ${err.message}`);
      }
    }

    // Buscar simultáneamente películas y series en Cinemeta en vivo
    try {
      const [mRes, sRes] = await Promise.all([
        axios.get(`${this.cinemetaBase}/catalog/movie/top/search=${encodeURIComponent(query)}.json`, { timeout: 6000 }).catch(() => ({ data: { metas: [] } })),
        axios.get(`${this.cinemetaBase}/catalog/series/top/search=${encodeURIComponent(query)}.json`, { timeout: 6000 }).catch(() => ({ data: { metas: [] } }))
      ]);

      const onlineResults = [];
      if (mRes.data && Array.isArray(mRes.data.metas)) {
        onlineResults.push(...mRes.data.metas.map(m => this.formatCinemetaItem(m, 'movie')));
      }
      if (sRes.data && Array.isArray(sRes.data.metas)) {
        onlineResults.push(...sRes.data.metas.map(s => this.formatCinemetaItem(s, 'series')));
      }

      if (onlineResults.length > 0) {
        const merged = new Map();
        localMatches.forEach(it => merged.set(it.id, it));
        onlineResults.forEach(it => merged.set(it.id, it));
        return Array.from(merged.values());
      }
    } catch (err) {
      logger.debug(`Error en búsqueda Cinemeta: ${err.message}`);
    }

    return localMatches;
  }

  async getDetails(id) {
    const cleanId = id.replace('vod::', '');
    
    // Si ya está en caché
    const cached = this.cachedItems.find(it => it.id === id || it.imdbId === cleanId);
    const isSeries = cached ? cached.contentType === 'series' : false;

    // Intentar obtener detalles profundos (cast, director, trailer) desde Cinemeta
    if (cleanId.startsWith('tt')) {
      const endpoints = isSeries 
        ? [`${this.cinemetaBase}/meta/series/${cleanId}.json`, `${this.cinemetaBase}/meta/movie/${cleanId}.json`]
        : [`${this.cinemetaBase}/meta/movie/${cleanId}.json`, `${this.cinemetaBase}/meta/series/${cleanId}.json`];

      for (const endpoint of endpoints) {
        try {
          const res = await axios.get(endpoint, { timeout: 6000 });
          if (res.data && res.data.meta) {
            const detectedType = endpoint.includes('/meta/series/') ? 'series' : 'movie';
            const formatted = this.formatCinemetaItem(res.data.meta, detectedType);
            if (cached?.isNetflix) formatted.isNetflix = true;
            return formatted;
          }
        } catch {
          // Probar siguiente endpoint
        }
      }
    }

    return cached || null;
  }
}
