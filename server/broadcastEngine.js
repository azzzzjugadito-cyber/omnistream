import { getCurrentAndNextProgram } from './epgParser.js';

/**
 * Normaliza nombres de competiciones o países para comparación exacta
 */
function normalizeText(str = '') {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Deduce el idioma de retransmisión según el país y título del canal
 */
export function deduceLanguage(country = '', title = '') {
  const c = (country || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();

  // 1. Detección por país oficial
  if (c === 'españa' || c === 'argentina' || c === 'méxico' || c === 'mexico' || c === 'colombia' || c === 'chile' || c === 'latam' || c === 'es' || c === 'ar' || c === 'mx') {
    return 'es';
  }
  if (c === 'reino unido' || c === 'uk' || c === 'england' || c === 'australia' || c === 'au') {
    return 'en';
  }
  if (c === 'estados unidos' || c === 'usa' || c === 'us') {
    if (t.includes('deportes') || t.includes('universo') || t.includes('telemundo') || t.includes('univision')) return 'es';
    return 'en';
  }
  if (c === 'francia' || c === 'france' || c === 'fr') {
    return 'fr';
  }
  if (c === 'italia' || c === 'italy' || c === 'it') {
    return 'it';
  }
  if (c === 'alemania' || c === 'germany' || c === 'de') {
    return 'de';
  }
  if (c === 'portugal' || c === 'brasil' || c === 'brazil' || c === 'pt' || c === 'br') {
    return 'pt';
  }
  if (c === 'países bajos' || c === 'netherlands' || c === 'holanda' || c === 'nl') {
    return 'nl';
  }

  // 2. Detección por palabras clave en título si el país es Internacional o desconocido
  if (/\b(espanol|castellano|deportes|laliga|movistar|gol)\b/i.test(t)) return 'es';
  if (/\b(english|sky sports|tnt sports|premier league|nbc)\b/i.test(t)) return 'en';
  if (/\b(canal\+|rmc|beinsports fr|telefoot)\b/i.test(t)) return 'fr';
  if (/\b(calcio|rai sport)\b/i.test(t)) return 'it';
  if (/\b(bundesliga|sky sport de|zdf|ard)\b/i.test(t)) return 'de';
  if (/\b(sport tv|premiere|sportv)\b/i.test(t)) return 'pt';
  if (/\b(ziggo sport)\b/i.test(t)) return 'nl';

  return 'en'; // idioma internacional por defecto
}

const CANONICAL_COMPETITIONS = {
  'laligaeasports': 'laliga',
  'laliga': 'laliga',
  'laligahypermotion': 'laliga2',
  'premierleague': 'premierleague',
  'englishpremierleague': 'premierleague',
  'russianpremierleague': 'russianpremierleague',
  'egyptianpremierleague': 'egyptianpremierleague',
  'uefachampionsleague': 'championsleague',
  'championsleague': 'championsleague',
  'uefaeuropaleague': 'europaleague',
  'europaleague': 'europaleague',
  'seriea': 'seriea',
  'bundesliga': 'bundesliga',
  'ligue1': 'ligue1',
  'copadelrey': 'copadelrey',
  'eredivisie': 'eredivisie',
  'brasileirao': 'brasileirao',
  'ligaprofesional': 'ligaprofesional',
  'ligamx': 'ligamx',
  'ligaportugal': 'ligaportugal',
  'superlig': 'superlig',
  'turkishsuperlig': 'superlig',
  'superleaguegreece': 'superleaguegreece',
  'indiansuperleague': 'indiansuperleague',
  'saudiproleague': 'saudiproleague',
  'botolapro': 'botolapro',
  'aleague': 'aleague',
  'psl': 'psl',
  'ekstraklasa': 'ekstraklasa',
  'mls': 'mls'
};

function getCanonicalComp(comp = '') {
  const norm = normalizeText(comp);
  return CANONICAL_COMPETITIONS[norm] || norm;
}

/**
 * Comprueba coincidencia estricta de competición entre fixture y canal
 */
function matchCompetition(fixtureComp = '', channelComps = []) {
  if (!fixtureComp || !Array.isArray(channelComps) || channelComps.length === 0) return false;
  const fCanon = getCanonicalComp(fixtureComp);

  return channelComps.some(c => {
    const cCanon = getCanonicalComp(c);
    return fCanon === cCanon;
  });
}

/**
 * Comprueba coincidencia estricta de país + nombre de equipo en el canal
 */
function matchCountryAndTeam(fixture, channel) {
  if (!fixture.country || !channel.country) return false;
  const fCountry = normalizeText(fixture.country);
  const cCountry = normalizeText(channel.country);

  // Mismo país
  if (fCountry !== cCountry) return false;

  const chTitleNorm = (channel.title || '').toLowerCase();
  const home = (fixture.homeTeam || '').toLowerCase().trim();
  const away = (fixture.awayTeam || '').toLowerCase().trim();

  // Nombre de equipo contenido en el nombre del canal (ej: Real Madrid TV, Barça One)
  if (home && home.length > 3 && chTitleNorm.includes(home)) return true;
  if (away && away.length > 3 && chTitleNorm.includes(away)) return true;

  return false;
}

class BroadcastEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 60 * 1000; // 60 segundos de caché por fixture
  }

  /**
   * Enlaza fixture → canal → streams[] calculando la entidad Broadcast
   */
  enrichFixture(fixture, liveChannels = [], prefLang = 'es', getEpgPrograms = () => []) {
    const cacheKey = `${fixture.id}::${prefLang}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.cachedAt < this.cacheTtlMs)) {
      return {
        ...fixture,
        broadcasts: cached.broadcasts,
        hasBroadcast: cached.hasBroadcast,
        status: cached.status
      };
    }

    // 1. Filtrar canales candidatos con el criterio estricto:
    // coincidencia de competición O (coincidencia de país + nombre de equipo en el canal)
    const matchedChannels = [];

    for (const ch of liveChannels) {
      const isCompMatch = matchCompetition(fixture.competition, ch.competitions);
      const isTeamMatch = matchCountryAndTeam(fixture, ch);

      if (isCompMatch || isTeamMatch) {
        matchedChannels.push(ch);
      }
    }

    // 2. Mapear a la entidad Broadcast en memoria
    const broadcasts = matchedChannels.map(ch => {
      const lang = deduceLanguage(ch.country, ch.title);
      const isPref = prefLang === 'all' || lang === prefLang;

      return {
        id: ch.id,
        sourceId: ch.sourceId,
        channelName: ch.title,
        logo: ch.logo,
        country: ch.country,
        language: lang,
        isPreferredLang: isPref,
        footballTier: ch.footballTier || 2,
        priority: ch.effectivePriority || ch.priority || 10,
        streamUrl: ch.streamUrl,
        backupUrls: Array.isArray(ch.backupUrls) ? ch.backupUrls : [],
        headers: ch.headers || {}
      };
    });

    // 3. Ordenar:
    // a) Idioma preferido primero
    // b) footballTier asc (Tier 1 dedicados antes de Tier 2 generalistas)
    // c) priority asc
    broadcasts.sort((a, b) => {
      const prefDiff = (b.isPreferredLang ? 1 : 0) - (a.isPreferredLang ? 1 : 0);
      if (prefDiff !== 0) return prefDiff;

      const tierDiff = (a.footballTier || 2) - (b.footballTier || 2);
      if (tierDiff !== 0) return tierDiff;

      return (a.priority || 10) - (b.priority || 10);
    });

    // 4. Tope de 6 broadcasts por fixture
    const topBroadcasts = broadcasts.slice(0, 6);
    const hasBroadcast = topBroadcasts.length > 0;

    // 5. Detección de directo por EPG
    // Un fixture pasa a 'live' si su kickoff está dentro de la ventana ±15 min (hasta +120 min)
    // y hay un programa EPG en algún canal de sus broadcasts cuyo título case con los equipos o "A vs B" / "A - B"
    let status = 'scheduled';
    const kickoffTime = new Date(fixture.timestamp).getTime();
    const diffMinutes = (now - kickoffTime) / (1000 * 60);

    const inKickoffWindow = diffMinutes >= -15 && diffMinutes <= 125;

    if (inKickoffWindow && hasBroadcast) {
      const homeNorm = (fixture.homeTeam || '').toLowerCase().trim();
      const awayNorm = (fixture.awayTeam || '').toLowerCase().trim();

      for (const b of topBroadcasts) {
        const progs = getEpgPrograms(b.sourceId, b.id);
        if (Array.isArray(progs) && progs.length > 0) {
          const { current } = getCurrentAndNextProgram(progs, new Date(now));
          if (current && current.title) {
            const pTitle = current.title.toLowerCase();
            const matchesTeams = (homeNorm && pTitle.includes(homeNorm)) || (awayNorm && pTitle.includes(awayNorm));
            const matchesVsPattern = (/\b(vs|-|x)\b/i.test(pTitle)) && (pTitle.includes(homeNorm) || pTitle.includes(awayNorm));

            if (matchesTeams || matchesVsPattern) {
              status = 'live';
              break;
            }
          }
        }
      }
    } else if (diffMinutes > 125) {
      status = 'finished';
    }

    const result = {
      ...fixture,
      broadcasts: topBroadcasts,
      hasBroadcast,
      status
    };

    // Guardar en caché
    this.cache.set(cacheKey, {
      broadcasts: topBroadcasts,
      hasBroadcast,
      status,
      cachedAt: now
    });

    return result;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const broadcastEngine = new BroadcastEngine();
