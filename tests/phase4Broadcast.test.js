import test from 'node:test';
import assert from 'node:assert';
import { broadcastEngine, deduceLanguage } from '../server/broadcastEngine.js';
import { sourceManager } from '../server/sources/index.js';

test('deduceLanguage deduce correctamente el idioma por país y título sin falsos positivos en espn', () => {
  assert.strictEqual(deduceLanguage('España', 'Movistar Plus+ LaLiga'), 'es');
  assert.strictEqual(deduceLanguage('Reino Unido', 'Sky Sports Premier League'), 'en');
  assert.strictEqual(deduceLanguage('Países Bajos', 'ESPN 2 (Netherlands)'), 'nl');
  assert.strictEqual(deduceLanguage('Francia', 'Canal+ Sport'), 'fr');
  assert.strictEqual(deduceLanguage('Italia', 'Sky Sport Serie A'), 'it');
  assert.strictEqual(deduceLanguage('Alemania', 'Sky Sport Bundesliga'), 'de');
  assert.strictEqual(deduceLanguage('Brasil', 'Premiere 1'), 'pt');
});

test('Coincidencia estricta: SuperSport Malasia NO casa con El Clásico, pero Real Madrid TV y Movistar sí', () => {
  const elClasico = {
    id: 'el-clasico-test',
    title: 'Real Madrid vs Barcelona',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    competition: 'LaLiga EA Sports',
    country: 'España',
    timestamp: new Date().toISOString()
  };

  const mockChannels = [
    {
      id: 'supersport-my',
      title: 'SuperSport 3 Malaysia',
      country: 'Malasia',
      competitions: ['A-League', 'Super League Malaysia'],
      streamUrl: 'http://malaysia.stream/live.m3u8',
      footballTier: 1,
      priority: 1
    },
    {
      id: 'rmtv',
      title: 'Real Madrid TV',
      country: 'España',
      competitions: ['LaLiga EA Sports'],
      streamUrl: 'http://rmtv.stream/live.m3u8',
      footballTier: 1,
      priority: 1
    },
    {
      id: 'movistar-laliga',
      title: 'Movistar Plus+ LaLiga',
      country: 'España',
      competitions: ['LaLiga EA Sports'],
      streamUrl: 'http://movistar.stream/live.m3u8',
      footballTier: 1,
      priority: 1
    }
  ];

  const enriched = broadcastEngine.enrichFixture(elClasico, mockChannels, 'es', () => []);
  assert.strictEqual(enriched.hasBroadcast, true);
  assert.strictEqual(enriched.broadcasts.length, 2);

  // SuperSport Malasia NO debe estar
  const channelNames = enriched.broadcasts.map(b => b.channelName);
  assert.ok(!channelNames.includes('SuperSport 3 Malaysia'));
  assert.ok(channelNames.includes('Real Madrid TV'));
  assert.ok(channelNames.includes('Movistar Plus+ LaLiga'));
});

test('Preferencia de idioma: español pone canales en español primero sin ocultar los en inglés', () => {
  const match = {
    id: 'pl-match',
    title: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    country: 'Reino Unido',
    timestamp: new Date().toISOString()
  };

  const channels = [
    {
      id: 'sky-uk',
      title: 'Sky Sports Premier League',
      country: 'Reino Unido',
      competitions: ['Premier League'],
      streamUrl: 'http://sky.uk/stream.m3u8',
      footballTier: 1,
      priority: 1
    },
    {
      id: 'dazn-es',
      title: 'DAZN 1 España',
      country: 'España',
      competitions: ['Premier League'],
      streamUrl: 'http://dazn.es/stream.m3u8',
      footballTier: 1,
      priority: 1
    }
  ];

  // Con preferencia español
  const enEsp = broadcastEngine.enrichFixture(match, channels, 'es', () => []);
  assert.strictEqual(enEsp.broadcasts.length, 2);
  assert.strictEqual(enEsp.broadcasts[0].channelName, 'DAZN 1 España');
  assert.strictEqual(enEsp.broadcasts[1].channelName, 'Sky Sports Premier League');

  // Con preferencia inglés
  broadcastEngine.clearCache();
  const enEng = broadcastEngine.enrichFixture(match, channels, 'en', () => []);
  assert.strictEqual(enEng.broadcasts.length, 2);
  assert.strictEqual(enEng.broadcasts[0].channelName, 'Sky Sports Premier League');
  assert.strictEqual(enEng.broadcasts[1].channelName, 'DAZN 1 España');
});

test('Tope de 6 broadcasts por fixture y fixture sin emisión devuelve hasBroadcast: false', () => {
  const match = {
    id: 'ucl-big',
    title: 'Inter vs Juventus',
    homeTeam: 'Inter',
    awayTeam: 'Juventus',
    competition: 'Serie A',
    country: 'Italia',
    timestamp: new Date().toISOString()
  };

  const manyChannels = [
    { id: 'ch-1', title: 'Sky Sport Serie A 1', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s1', footballTier: 1, priority: 1 },
    { id: 'ch-2', title: 'Sky Sport Serie A 2', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s2', footballTier: 1, priority: 2 },
    { id: 'ch-3', title: 'DAZN 1 Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s3', footballTier: 1, priority: 3 },
    { id: 'ch-4', title: 'DAZN 2 Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s4', footballTier: 1, priority: 4 },
    { id: 'ch-5', title: 'Rai Sport Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s5', footballTier: 1, priority: 5 },
    { id: 'ch-6', title: 'Mediaset Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s6', footballTier: 1, priority: 6 },
    { id: 'ch-7', title: 'Eleven Sports Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s7', footballTier: 1, priority: 7 },
    { id: 'ch-8', title: 'Canal+ Serie A', country: 'Italia', competitions: ['Serie A'], streamUrl: 'http://s8', footballTier: 1, priority: 8 }
  ];

  broadcastEngine.clearCache();
  const res = broadcastEngine.enrichFixture(match, manyChannels, 'es', () => []);
  assert.strictEqual(res.broadcasts.length, 6); // Tope de 6

  // Fixture sin emisión
  const emptyMatch = {
    id: 'no-broadcast',
    title: 'Equipo A vs Equipo B',
    homeTeam: 'Equipo A',
    awayTeam: 'Equipo B',
    competition: 'Liga Desconocida',
    country: 'Pais X',
    timestamp: new Date().toISOString()
  };
  const emptyRes = broadcastEngine.enrichFixture(emptyMatch, manyChannels, 'es', () => []);
  assert.strictEqual(emptyRes.hasBroadcast, false);
  assert.deepStrictEqual(emptyRes.broadcasts, []);
});

test('Detección de directo por EPG: sólo pasa a live si EPG casa con equipos en ventana ±15 min', () => {
  const now = new Date();
  const liveMatch = {
    id: 'epg-live-test',
    title: 'Real Madrid vs Barcelona',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    competition: 'LaLiga EA Sports',
    country: 'España',
    timestamp: now.toISOString()
  };

  const channel = {
    id: 'rmtv-epg',
    sourceId: 'tdtchannels-es',
    title: 'Real Madrid TV',
    country: 'España',
    competitions: ['LaLiga EA Sports'],
    streamUrl: 'http://rmtv.stream/live.m3u8',
    footballTier: 1,
    priority: 1
  };

  // EPG con programa coincidente
  const mockEpgPrograms = [
    {
      title: 'En Directo: Real Madrid vs Barcelona',
      start: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      stop: new Date(now.getTime() + 80 * 60 * 1000).toISOString()
    }
  ];

  broadcastEngine.clearCache();
  const confirmed = broadcastEngine.enrichFixture(liveMatch, [channel], 'es', () => mockEpgPrograms);
  assert.strictEqual(confirmed.status, 'live');

  // Sin EPG coincidente, el estado se queda en scheduled
  broadcastEngine.clearCache();
  const unconfirmed = broadcastEngine.enrichFixture(liveMatch, [channel], 'es', () => []);
  assert.strictEqual(unconfirmed.status, 'scheduled');
});

test('Explorador cubre al menos 20 países con sus competiciones', async () => {
  await sourceManager.loadFromYaml();
  const events = await sourceManager.getSportsEvents({ lang: 'es' });
  const countries = new Set(events.map(e => e.country));
  assert.ok(countries.size >= 20, `El explorador debe cubrir >= 20 países (cubre ${countries.size})`);
});
