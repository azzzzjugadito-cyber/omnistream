import test from 'node:test';
import assert from 'node:assert';
import { parseM3u } from '../server/m3uParser.js';

test('parseM3u normaliza correctamente directivas EXTINF y atributos TVG', () => {
  const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="Teledeporte.es" tvg-name="Teledeporte" tvg-logo="https://example.com/tdp.png" group-title="Deportes",Teledeporte HD
https://example.com/live/tdp.m3u8
`;

  const items = parseM3u(sampleM3u);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].name, 'Teledeporte HD');
  assert.strictEqual(items[0].tvgId, 'Teledeporte.es');
  assert.strictEqual(items[0].logo, 'https://example.com/tdp.png');
  assert.strictEqual(items[0].category, 'Deportes');
  assert.strictEqual(items[0].url, 'https://example.com/live/tdp.m3u8');
});

test('parseM3u extrae cabeceras User-Agent y Referer desde directivas EXTVLCOPT', () => {
  const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="RealMadridTV" group-title="Fútbol",Real Madrid TV
#EXTVLCOPT:http-referrer=https://www.realmadrid.com/
#EXTVLCOPT:http-user-agent=CustomStreamer/1.0
https://rmtv.example.com/master.m3u8
`;

  const items = parseM3u(sampleM3u);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].headers['Referer'], 'https://www.realmadrid.com/');
  assert.strictEqual(items[0].headers['User-Agent'], 'CustomStreamer/1.0');
});

test('parseM3u gestiona listas vacías o contenido no válido sin fallar', () => {
  assert.deepStrictEqual(parseM3u(''), []);
  assert.deepStrictEqual(parseM3u(null), []);
  assert.deepStrictEqual(parseM3u('solo texto sin formato'), []);
});
