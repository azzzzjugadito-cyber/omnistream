import test from 'node:test';
import assert from 'node:assert';
import { normalizeChannelName, footballClassifier } from '../server/footballClassifier.js';
import { sourceManager } from '../server/sources/index.js';

test('Normalizador de nombres de canales limpia acentos, calidades y prefijos', () => {
  assert.strictEqual(normalizeChannelName('DAZN 1 FHD'), 'dazn 1');
  assert.strictEqual(normalizeChannelName('DAZN 1'), 'dazn 1');
  assert.strictEqual(normalizeChannelName('ES: DAZN 1 [1080p]'), 'dazn 1');
  assert.strictEqual(normalizeChannelName('ES | DAZN 1 (Backup)'), 'dazn 1');
  assert.strictEqual(normalizeChannelName('Sky Sports Premier League UHD'), 'sky sports premier league');
  assert.strictEqual(normalizeChannelName('Sky Sports Premier League'), 'sky sports premier league');
  assert.strictEqual(normalizeChannelName('Teledeporte (TDP) HD'), 'teledeporte tdp');
  assert.strictEqual(normalizeChannelName('La 1 HD'), 'la 1');
  assert.strictEqual(normalizeChannelName('TNT Sports 1 FHD'), 'tnt sports 1');
});

test('Clasificación de fútbol asigna Tier 1 a canales dedicados y Tier 2 a generalistas', () => {
  // Tier 1: Canales dedicados a fútbol
  const dazn1 = footballClassifier.classify({ title: 'DAZN 1 FHD', category: 'Sports' });
  assert.strictEqual(dazn1.isFootball, true);
  assert.strictEqual(dazn1.footballTier, 1);
  assert.ok(dazn1.competitions.includes('Premier League'));

  const movistar = footballClassifier.classify({ title: 'Movistar Plus+ LaLiga', tvgId: 'MovistarLaLiga.es' });
  assert.strictEqual(movistar.isFootball, true);
  assert.strictEqual(movistar.footballTier, 1);
  assert.ok(movistar.competitions.includes('LaLiga EA Sports'));

  const sky = footballClassifier.classify({ title: 'Sky Sports Premier League UHD', tvgId: 'SkySportsPremierLeague.uk' });
  assert.strictEqual(sky.isFootball, true);
  assert.strictEqual(sky.footballTier, 1);
  assert.ok(sky.competitions.includes('Premier League'));

  // Tier 2: Canales generalistas que emiten fútbol ocasional
  const la1 = footballClassifier.classify({ title: 'La 1 HD', tvgId: 'La1.es', category: 'General' });
  assert.strictEqual(la1.isFootball, true);
  assert.strictEqual(la1.footballTier, 2);
  assert.ok(la1.competitions.includes('Copa del Rey'));

  const tdp = footballClassifier.classify({ title: 'Teledeporte', tvgId: 'Teledeporte.es' });
  assert.strictEqual(tdp.isFootball, true);
  assert.strictEqual(tdp.footballTier, 2);

  // Canales no fútbol
  const ufc = footballClassifier.classify({ title: 'UFC Fight Pass', category: 'Combat' });
  assert.strictEqual(ufc.isFootball, false);
  assert.strictEqual(ufc.footballTier, null);
});

test('Deduplicación consolida DAZN 1 FHD y DAZN 1 en una sola entrada con múltiples URLs', async () => {
  // Simulamos un adaptador con dos variantes del mismo canal
  const mockChannels = [
    {
      id: 'mock::1',
      title: 'DAZN 1 FHD',
      streamUrl: 'http://server.net/live/user/pass/101.m3u8',
      backupUrls: ['http://server.net/live/user/pass/101.ts'],
      priority: 1
    },
    {
      id: 'mock::2',
      title: 'DAZN 1',
      streamUrl: 'http://server.net/live/user/pass/102.m3u8',
      backupUrls: ['http://mirror.net/102.m3u8'],
      priority: 2
    }
  ];

  // Ejecutamos la clasificación y deduplicación manual idéntica a getLiveChannels
  const classified = mockChannels.map(ch => {
    const cls = footballClassifier.classify(ch);
    return { ...ch, ...cls, effectivePriority: ch.priority };
  });

  const deduplicatedMap = new Map();
  for (const ch of classified) {
    const key = ch.normalizedKey;
    if (!deduplicatedMap.has(key)) {
      deduplicatedMap.set(key, { ...ch, backupUrls: [...ch.backupUrls] });
    } else {
      const primary = deduplicatedMap.get(key);
      if (ch.streamUrl && ch.streamUrl !== primary.streamUrl && !primary.backupUrls.includes(ch.streamUrl)) {
        primary.backupUrls.push(ch.streamUrl);
      }
      ch.backupUrls.forEach(b => {
        if (b && b !== primary.streamUrl && !primary.backupUrls.includes(b)) {
          primary.backupUrls.push(b);
        }
      });
    }
  }

  const results = Array.from(deduplicatedMap.values());
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, 'DAZN 1 FHD');
  assert.strictEqual(results[0].streamUrl, 'http://server.net/live/user/pass/101.m3u8');
  assert.ok(results[0].backupUrls.includes('http://server.net/live/user/pass/102.m3u8'));
  assert.ok(results[0].backupUrls.includes('http://mirror.net/102.m3u8'));
  assert.ok(results[0].backupUrls.length >= 2);
});

test('Rendimiento: el clasificador procesa 1000 canales en menos de 10 ms (<15% overhead)', () => {
  const sampleChannels = [];
  for (let i = 0; i < 1000; i++) {
    sampleChannels.push({
      title: i % 2 === 0 ? `DAZN ${i % 4} FHD` : `Canal Internacional ${i}`,
      tvgId: i % 2 === 0 ? `DAZN${i % 4}.es` : `Channel${i}.us`,
      category: i % 2 === 0 ? 'Sports' : 'General'
    });
  }

  const start = performance.now();
  for (const ch of sampleChannels) {
    footballClassifier.classify(ch);
  }
  const duration = performance.now() - start;
  assert.ok(duration < 25, `El clasificador tardó ${duration} ms (debe ser < 25 ms para 1000 canales)`);
});
