import test from 'node:test';
import assert from 'node:assert';
import { parseDocument } from 'yaml';
import { parseXmltv, parseXmltvDate, getCurrentAndNextProgram } from '../server/epgParser.js';
import { XtreamAdapter } from '../server/sources/XtreamAdapter.js';

test('parseXmltvDate convierte fechas estándar XMLTV a Date correctamente', () => {
  const d = parseXmltvDate('20261118204500 +0100');
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getUTCFullYear(), 2026);
  assert.strictEqual(d.getUTCMonth(), 10); // 0-based, Noviembre es 10
  assert.strictEqual(d.getUTCDate(), 18);
  assert.strictEqual(d.getUTCHours(), 19); // 20:45 +01:00 -> 19:45 UTC
  assert.strictEqual(d.getUTCMinutes(), 45);
});

test('parseXmltv extrae canales y programas XMLTV', () => {
  const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
  <tv>
    <channel id="laligatv">
      <display-name>LaLiga TV</display-name>
    </channel>
    <programme start="20261118180000 +0000" stop="20261118200000 +0000" channel="laligatv">
      <title>Previa El Clásico</title>
      <desc>Análisis previo al partido</desc>
    </programme>
    <programme start="20261118200000 +0000" stop="20261118220000 +0000" channel="laligatv">
      <title>El Clásico en Directo</title>
      <desc>Retransmisión oficial del partido</desc>
    </programme>
  </tv>`;

  const epgMap = parseXmltv(sampleXml);
  assert.ok(epgMap.has('laligatv'));
  const progs = epgMap.get('laligatv');
  assert.strictEqual(progs.length, 2);
  assert.strictEqual(progs[0].title, 'Previa El Clásico');
  assert.strictEqual(progs[1].title, 'El Clásico en Directo');

  // Test de programa actual
  const targetTime = new Date('2026-11-18T20:30:00Z');
  const { current, next } = getCurrentAndNextProgram(progs, targetTime);
  assert.ok(current);
  assert.strictEqual(current.title, 'El Clásico en Directo');
});

test('XtreamAdapter interpola credenciales desde variables de entorno y construye URLs estándar', () => {
  process.env.TEST_XTREAM_USER = 'usuario_seguro';
  process.env.TEST_XTREAM_PASS = 'pass_segura_123';

  const adapter = new XtreamAdapter({
    id: 'xtream-test',
    host: 'iptv.servidor.net',
    port: 8080,
    protocol: 'http',
    usernameEnv: 'TEST_XTREAM_USER',
    passwordEnv: 'TEST_XTREAM_PASS',
    streamExt: 'm3u8',
    priority: 1
  });

  assert.strictEqual(adapter.username, 'usuario_seguro');
  assert.strictEqual(adapter.password, 'pass_segura_123');
  assert.strictEqual(adapter.getBaseUrl(), 'http://iptv.servidor.net:8080');

  const apiUrl = adapter.getPlayerApiUrl('get_live_streams');
  assert.ok(apiUrl.includes('username=usuario_seguro'));
  assert.ok(apiUrl.includes('password=pass_segura_123'));
  assert.ok(apiUrl.includes('action=get_live_streams'));

  const xmltvUrl = adapter.getXmltvUrl();
  assert.ok(xmltvUrl.startsWith('http://iptv.servidor.net:8080/xmltv.php'));
});

test('XtreamAdapter degrada a lista vacía sin tumbar el arranque si el servidor no responde', async () => {
  const adapter = new XtreamAdapter({
    id: 'xtream-dead',
    host: '127.0.0.1',
    port: 9999, // Puerto cerrado no existente
    username: 'test',
    password: 'bad'
  });

  const res = await adapter.init();
  assert.strictEqual(res, true);
  assert.deepStrictEqual(adapter.cachedItems, []);
});

test('Modificación de sources.yaml preserva comentarios y formato con parseDocument', () => {
  const yamlContentWithComments = `# Cabecera de prueba
# Configuración global
sources:
  # Entrada 1
  - id: "source-1"
    name: "Fuente 1"
    enabled: true
`;
  const doc = parseDocument(yamlContentWithComments);
  const sources = doc.get('sources');
  sources.add({ id: 'source-2', name: 'Fuente 2', enabled: false });
  const output = doc.toString({ lineWidth: 0 });
  assert.ok(output.includes('# Cabecera de prueba'));
  assert.ok(output.includes('# Entrada 1'));
  assert.ok(output.includes('source-2'));
});
