import axios from 'axios';
import { BaseAdapter } from './BaseAdapter.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const LEAGUES = [
  { id: '4335', name: 'LaLiga EA Sports', sport: 'Fútbol', country: 'España' },
  { id: '4328', name: 'Premier League', sport: 'Fútbol', country: 'Reino Unido' },
  { id: '4480', name: 'UEFA Champions League', sport: 'Fútbol', country: 'Europa' },
  { id: '4331', name: 'Bundesliga', sport: 'Fútbol', country: 'Alemania' },
  { id: '4332', name: 'Serie A', sport: 'Fútbol', country: 'Italia' },
  { id: '4387', name: 'NBA', sport: 'Baloncesto', country: 'Estados Unidos' },
  { id: '4443', name: 'UFC', sport: 'Deportes de contacto', country: 'Internacional' },
  { id: '4370', name: 'Formula 1', sport: 'Motor', country: 'Internacional' },
  { id: '4407', name: 'MotoGP', sport: 'Motor', country: 'Internacional' },
  { id: '4445', name: 'Boxeo Profesional', sport: 'Deportes de contacto', country: 'Internacional' }
];

export class SportsEventAdapter extends BaseAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.type = 'sports_events';
    this.apiKey = config.theSportsDbKey;
    this.baseUrl = `https://www.thesportsdb.com/api/v1/json/${this.apiKey}`;
  }

  async init() {
    return this.refreshCache();
  }

  async refreshCache() {
    try {
      logger.info('Consultando agenda de eventos deportivos en TheSportsDB...');
      const allEvents = [];

      // Consultar en paralelo para cada liga con límite de concurrencia
      const promises = LEAGUES.map(async (league) => {
        try {
          const res = await axios.get(`${this.baseUrl}/eventsnextleague.php?id=${league.id}`, {
            timeout: 7000
          });
          if (res.data && Array.isArray(res.data.events)) {
            return res.data.events.map(ev => ({
              id: `event::${ev.idEvent}`,
              sourceId: this.id,
              eventId: ev.idEvent,
              title: ev.strEvent,
              homeTeam: ev.strHomeTeam || '',
              awayTeam: ev.strAwayTeam || '',
              competition: league.name,
              sport: league.sport,
              country: league.country,
              date: ev.dateEvent,
              time: ev.strTime,
              timestamp: ev.strTimestamp || `${ev.dateEvent}T${ev.strTime || '20:00:00'}`,
              badge: ev.strLeagueBadge || ev.strPoster || ev.strThumb,
              poster: ev.strThumb || ev.strPoster || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80',
              status: this.computeEventStatus(ev.strTimestamp || `${ev.dateEvent}T${ev.strTime || '20:00:00'}`),
              type: 'event'
            }));
          }
        } catch (err) {
          logger.debug(`No se pudieron obtener eventos para la liga ${league.name}: ${err.message}`);
        }
        return [];
      });

      const results = await Promise.all(promises);
      results.forEach(evList => allEvents.push(...evList));

      // Ordenar por fecha/hora ascendente
      allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      this.cachedItems = allEvents;
      this.lastFetched = Date.now();
      logger.info(`Agenda deportiva actualizada: ${this.cachedItems.length} eventos programados.`);
      return this.cachedItems;
    } catch (err) {
      logger.error(`Error actualizando agenda deportiva: ${err.message}`);
      return this.cachedItems;
    }
  }

  computeEventStatus(timestampStr) {
    if (!timestampStr) return 'Programado';
    const eventTime = new Date(timestampStr).getTime();
    const now = Date.now();
    const diffHours = (eventTime - now) / (1000 * 60 * 60);

    if (diffHours < 0 && diffHours > -2.5) {
      return 'EN DIRECTO';
    } else if (diffHours >= 0 && diffHours <= 4) {
      return 'Comienza pronto';
    } else if (diffHours > 4 && diffHours <= 24) {
      return 'Hoy';
    }
    return 'Próximamente';
  }

  async list(filters = {}) {
    if (Date.now() - this.lastFetched > 10 * 60 * 1000 || this.cachedItems.length === 0) {
      await this.refreshCache();
    }

    let items = [...this.cachedItems];

    if (filters.sport && filters.sport !== 'Todos') {
      items = items.filter(it => it.sport.toLowerCase() === filters.sport.toLowerCase());
    }

    if (filters.competition) {
      items = items.filter(it => it.competition.toLowerCase().includes(filters.competition.toLowerCase()));
    }

    if (filters.todayOnly) {
      items = items.filter(it => ['EN DIRECTO', 'Comienza pronto', 'Hoy'].includes(it.status));
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(it => 
        it.title.toLowerCase().includes(q) || 
        it.competition.toLowerCase().includes(q) ||
        it.sport.toLowerCase().includes(q)
      );
    }

    return items;
  }
}
