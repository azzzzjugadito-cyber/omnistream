import test from 'node:test';
import assert from 'node:assert';
import { BaseAdapter } from '../server/sources/BaseAdapter.js';

test('BaseAdapter genera URLs de proxy válidas codificando parámetros y cabeceras', () => {
  const adapter = new BaseAdapter({
    id: 'test-adapter',
    headers: {
      'User-Agent': 'CustomBrowser/1.0',
      'Referer': 'https://origin.example.com/'
    }
  });

  const proxied = adapter.getProxiedUrl('https://stream.example.com/live.m3u8');
  assert.ok(proxied.startsWith('/api/proxy/stream?url=https%3A%2F%2Fstream.example.com%2Flive.m3u8'));
  assert.ok(proxied.includes('ref=https%3A%2F%2Forigin.example.com%2F'));
  assert.ok(proxied.includes('ua=CustomBrowser%2F1.0'));
});
