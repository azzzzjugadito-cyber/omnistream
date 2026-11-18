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
  const t = (title || '').toLowerCase().trim();
  const c = (country || '').toLowerCase().trim();

  // 1. Modificador explícito de idioma en el título del canal (ej: Real Madrid TV EN -> inglés)
  if (/\b(en|eng|english)\b/i.test(t) || /\s+en$/i.test(t) || /\(en\)/i.test(t)) {
    return 'en';
  }
  if (/\b(es|esp|espanol|castellano)\b/i.test(t) || /\s+es$/i.test(t) || /\(es\)/i.test(t)) {
    return 'es';
  }
  if (/\b(fr|fra|french|francais)\b/i.test(t) || /\s+fr$/i.test(t) || /\(fr\)/i.test(t)) {
    return 'fr';
  }
  if (/\b(de|deu|german|deutsch)\b/i.test(t) || /\s+de$/i.test(t) || /\(de\)/i.test(t)) {
    return 'de';
  }
  if (/\b(it|ita|italian|italiano)\b/i.test(t) || /\s+it$/i.test(t) || /\(it\)/i.test(t)) {
    return 'it';
  }
  if (/\b(pt|por|portugues)\b/i.test(t) || /\s+pt$/i.test(t) || /\(pt\)/i.test(t)) {
    return 'pt';
  }
  if (/\b(nl|ned|dutch|nederlands)\b/i.test(t) || /\s+nl$/i.test(t) || /\(nl\)/i.test(t)) {
    return 'nl';
  }

  // 2. Detección por país oficial del canal
  if (c === 'españa' || c === 'argentina' || c === 'méxico' || c === 'mexico' || c === 'colombia' || c === 'chile' || c === 'latam' || c === 'es' || c === 'ar' || c === 'mx') {
    return 'es';
  }
  if (c === 'reino unido' || c === 'uk' || c === 'england' || c === 'australia' || c === 'au' || c === 'india' || c === 'in' || c === 'sudáfrica' || c === 'za') {
    return 'en';
  }
  if (c === 'estados unidos' || c === 'usa' || c === 'us') {
    if (t.includes('deportes') || t.includes('universo') || t.includes('telemundo') || t.includes('univision')) return 'es';
    return 'en';
  }
  if (c === 'francia' || c === 'france' || c === 'fr') return 'fr';
  if (c === 'italia' || c === 'italy' || c === 'it') return 'it';
  if (c === 'alemania' || c === 'germany' || c === 'de') return 'de';
  if (c === 'portugal' || c === 'brasil' || c === 'brazil' || c === 'pt' || c === 'br') return 'pt';
  if (c === 'países bajos' || c === 'netherlands' || c === 'holanda' || c === 'nl') return 'nl';
  if (c === 'arabia saudí' || c === 'egipto' || c === 'marruecos') return 'ar';
  if (c === 'grecia') return 'el';
  if (c === 'turquía') return 'tr';
  if (c === 'rusia') return 'ru';
  if (c === 'polonia') return 'pl';

  return 'en'; // idioma internacional por defecto
}

const INTERNATIONAL_RIGHTS = {
  'premierleague': ['estadosunidos', 'usa', 'argentina', 'brasil', 'latam', 'francia', 'alemania', 'espana', 'sudafrica', 'egipto', 'qatar', 'catar', 'mena', 'portugal'],
  'laliga': ['estadosunidos', 'usa', 'reinounido', 'uk', 'francia', 'alemania', 'italia', 'paisesbajos', 'polonia', 'sudafrica'],
  'championsleague': ['espana', 'reinounido', 'uk', 'francia', 'alemania', 'italia', 'portugal', 'paisesbajos', 'estadosunidos', 'usa', 'argentina', 'brasil', 'latam', 'sudafrica', 'catar', 'qatar', 'mena', 'polonia'],
  'bundesliga': ['estadosunidos', 'usa', 'espana', 'reinounido', 'uk', 'francia', 'italia', 'sudafrica'],
  'seriea': ['espana', 'reinounido', 'uk', 'estadosunidos', 'usa', 'alemania', 'portugal', 'francia', 'argentina', 'paisesbajos'],
  'ligue1': ['catar', 'qatar', 'mena', 'espana', 'sudafrica'],
  'saudiproleague': ['arabiasaudi', 'catar', 'francia'],
  'psl': ['sudafrica', 'egipto', 'africa'],
  'egyptianpremierleague': ['egipto', 'sudafrica', 'africa'],
  'aleague': ['australia'],
  'indiansuperleague': ['india'],
  'superleaguegreece': ['grecia'],
  'ligaprofesional': ['argentina', 'latam', 'estadosunidos', 'usa'],
  'brasileirao': ['brasil', 'portugal'],
  'ligamx': ['mexico', 'estadosunidos', 'usa', 'latam', 'colombia', 'argentina']
};

function hasInternationalRights(channelCountry = '', competition = '') {
  const cNorm = normalizeText(channelCountry);
  const compCanon = getCanonicalComp(competition);
  const authorizedCountries = INTERNATIONAL_RIGHTS[compCanon];
  if (!authorizedCountries) return false;
  return authorizedCountries.some(auth => cNorm.includes(auth) || auth.includes(cNorm));
}

function getChannelFamily(title = '') {
  const t = (title || '').toLowerCase().trim();
  if (t.startsWith('espn')) return 'espn';
  if (t.startsWith('dazn')) return 'dazn';
  if (t.startsWith('canal+') || t.startsWith('canal plus')) return 'canal+';
  if (t.startsWith('sky')) return 'sky';
  if (t.startsWith('fox')) return 'fox';
  if (t.startsWith('tnt')) return 'tnt';
  if (t.startsWith('bein')) return 'bein';
  if (t.startsWith('supersport')) return 'supersport';
  if (t.startsWith('ssc')) return 'ssc';
  if (t.startsWith('star sports')) return 'starsports';
  if (t.startsWith('cosmote')) return 'cosmote';
  if (t.startsWith('optus')) return 'optus';
  return null;
}

function calculateScore(fixture, channel) {
  const isCompMatch = matchCompetition(fixture.competition, channel.competitions);
  const isTeamMatch = matchCountryAndTeam(fixture, channel);
  const fCountryNorm = normalizeText(fixture.country);
  const cCountryNorm = normalizeText(channel.country);
  const isSameCountry = fCountryNorm && cCountryNorm && (fCountryNorm === cCountryNorm || (fCountryNorm === 'espana' && cCountryNorm === 'espana'));

  // 1. Competición canónica coincidente Y país del canal = país de la competición -> 100
  if (isCompMatch && isSameCountry) {
    return 100;
  }

  // 2. País coincidente + nombre de equipo en el nombre del canal -> 80
  if (isTeamMatch) {
    return 80;
  }

  // 3. Competición canónica coincidente, canal de otro país
  if (isCompMatch) {
    if (hasInternationalRights(channel.country, fixture.competition)) {
      return 60; // derechos internacionales conocidos
    }
    return 20; // etiqueta sin derechos confirmados
  }

  return 0;
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

    // 1. Filtrar y puntuar canales candidatos con el sistema estricto (Umbral mínimo >= 60)
    const scoredCandidates = [];

    for (const ch of liveChannels) {
      const score = calculateScore(fixture, ch);
      if (score >= 60) {
        const lang = deduceLanguage(ch.country, ch.title);
        const isPref = prefLang === 'all' || lang === prefLang;

        scoredCandidates.push({
          id: ch.id,
          sourceId: ch.sourceId,
          channelName: ch.title,
          logo: ch.logo,
          country: ch.country,
          language: lang,
          isPreferredLang: isPref,
          footballTier: ch.footballTier || 2,
          priority: ch.effectivePriority || ch.priority || 10,
          score,
          streamUrl: ch.streamUrl,
          backupUrls: Array.isArray(ch.backupUrls) ? ch.backupUrls : [],
          headers: ch.headers || {}
        });
      }
    }

    // 2. Ordenar candidatos:
    // a) Idioma preferido primero
    // b) Puntuación del matcher descendente (100 > 80 > 60)
    // c) footballTier asc (Tier 1 dedicados antes de Tier 2 generalistas)
    // d) priority asc (desempate por fuente de mayor prioridad)
    scoredCandidates.sort((a, b) => {
      const prefDiff = (b.isPreferredLang ? 1 : 0) - (a.isPreferredLang ? 1 : 0);
      if (prefDiff !== 0) return prefDiff;

      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      const tierDiff = (a.footballTier || 2) - (b.footballTier || 2);
      if (tierDiff !== 0) return tierDiff;

      return (a.priority || 10) - (b.priority || 10);
    });

    // 3. Diversidad: máximo 2 canales por familia (ESPN, DAZN, Canal+, Sky, etc.) y tope de 6 broadcasts
    const selectedBroadcasts = [];
    const familyCounts = {};

    for (const b of scoredCandidates) {
      const family = getChannelFamily(b.channelName);
      if (family) {
        if ((familyCounts[family] || 0) >= 2) {
          continue; // descartar si ya hay 2 de esta familia
        }
      }

      selectedBroadcasts.push(b);
      if (family) {
        familyCounts[family] = (familyCounts[family] || 0) + 1;
      }

      if (selectedBroadcasts.length >= 6) {
        break;
      }
    }

    const topBroadcasts = selectedBroadcasts;
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
