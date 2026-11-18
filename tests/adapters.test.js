import test from 'node:test';
import assert from 'node:assert';
import { IptvOrgAdapter } from '../server/sources/IptvOrgAdapter.js';
import { TdtChannelsAdapter } from '../server/sources/TdtChannelsAdapter.js';
import { CinemetaVodAdapter } from '../server/sources/CinemetaVodAdapter.js';

test('IptvOrgAdapter detecta deportes y países a partir del nombre del canal', () => {
  const adapter = new IptvOrgAdapter({ id: 'test-iptv' });

  assert.strictEqual(adapter.detectSport('Movistar LaLiga', 'Sports'), 'Fútbol');
  assert.strictEqual(adapter.detectSport('NBA TV Live', 'Sports'), 'Baloncesto');
  assert.strictEqual(adapter.detectSport('Formula 1 Channel', 'Sports'), 'Motor');
  assert.strictEqual(adapter.detectSport('UFC Fight Pass', 'Sports'), 'Deportes de contacto');
  assert.strictEqual(adapter.detectSport('Canal General', 'General'), 'Deportes');

  assert.strictEqual(adapter.detectCountry('Teledeporte (Spain)'), 'España');
  assert.strictEqual(adapter.detectCountry('Sky Sports Main Event .uk'), 'Reino Unido');
});

test('TdtChannelsAdapter detecta canales deportivos españoles', () => {
  const adapter = new TdtChannelsAdapter({ id: 'test-tdt' });

  assert.strictEqual(adapter.detectSport('Teledeporte', 'Deportivos'), 'Deportes');
  assert.strictEqual(adapter.detectSport('Real Madrid TV', 'Deportivos'), 'Fútbol');
  assert.strictEqual(adapter.detectSport('La 1', 'Generalistas'), 'General');
});

test('CinemetaVodAdapter formatea metadatos de películas y series', () => {
  const adapter = new CinemetaVodAdapter({ id: 'test-vod' });
  const rawMeta = {
    imdb_id: 'tt1375666',
    name: 'Inception',
    year: '2010',
    genres: ['Action', 'Sci-Fi'],
    imdbRating: '8.8',
    description: 'A thief who steals corporate secrets through dream-sharing...',
    poster: 'https://example.com/poster.jpg',
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt'],
    director: ['Christopher Nolan']
  };

  const formatted = adapter.formatCinemetaItem(rawMeta, 'movie');
  assert.strictEqual(formatted.id, 'vod::tt1375666');
  assert.strictEqual(formatted.title, 'Inception');
  assert.strictEqual(formatted.contentType, 'movie');
  assert.strictEqual(formatted.director, 'Christopher Nolan');
  assert.strictEqual(formatted.rating, '8.8');
  assert.strictEqual(formatted.cast.length, 2);
});
