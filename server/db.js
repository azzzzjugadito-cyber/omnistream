import fs from 'fs';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { logger } from './logger.js';

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  logger.info(`Inicializando base de datos SQLite en: ${config.dbFile}`);
  dbInstance = new Database(config.dbFile);
  dbInstance.pragma('journal_mode = WAL');

  // Inicializar tablas
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster TEXT,
      stream_url TEXT,
      category TEXT,
      extra_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster TEXT,
      stream_url TEXT,
      position_seconds REAL DEFAULT 0,
      duration_seconds REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS source_health (
      source_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      latency_ms INTEGER,
      last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  logger.info('Tablas de SQLite verificadas y listas.');
  return dbInstance;
}

export const dbService = {
  // Favoritos
  getFavorites() {
    const db = getDb();
    return db.prepare('SELECT * FROM favorites ORDER BY created_at DESC').all();
  },

  isFavorite(itemId) {
    const db = getDb();
    const row = db.prepare('SELECT id FROM favorites WHERE item_id = ?').get(itemId);
    return !!row;
  },

  addFavorite({ itemId, type, title, poster, streamUrl, category, extraJson }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO favorites (item_id, type, title, poster, stream_url, category, extra_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_id) DO UPDATE SET
        title = excluded.title,
        poster = excluded.poster,
        stream_url = excluded.stream_url,
        category = excluded.category,
        extra_json = excluded.extra_json
    `);
    return stmt.run(itemId, type, title, poster || '', streamUrl || '', category || '', JSON.stringify(extraJson || {}));
  },

  removeFavorite(itemId) {
    const db = getDb();
    return db.prepare('DELETE FROM favorites WHERE item_id = ?').run(itemId);
  },

  // Historial / Continuar viendo
  getHistory(limit = 30) {
    const db = getDb();
    return db.prepare('SELECT * FROM history ORDER BY updated_at DESC LIMIT ?').all(limit);
  },

  updateHistory({ itemId, type, title, poster, streamUrl, positionSeconds, durationSeconds }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO history (item_id, type, title, poster, stream_url, position_seconds, duration_seconds, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_id) DO UPDATE SET
        title = excluded.title,
        poster = excluded.poster,
        stream_url = excluded.stream_url,
        position_seconds = excluded.position_seconds,
        duration_seconds = excluded.duration_seconds,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(itemId, type, title, poster || '', streamUrl || '', positionSeconds || 0, durationSeconds || 0);
  },

  clearHistory() {
    const db = getDb();
    return db.prepare('DELETE FROM history').run();
  },

  // Salud de fuentes
  saveSourceHealth(sourceId, status, latencyMs, errorMessage = null) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO source_health (source_id, status, latency_ms, last_checked, error_message)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(source_id) DO UPDATE SET
        status = excluded.status,
        latency_ms = excluded.latency_ms,
        last_checked = CURRENT_TIMESTAMP,
        error_message = excluded.error_message
    `);
    return stmt.run(sourceId, status, latencyMs, errorMessage);
  },

  getAllSourceHealth() {
    const db = getDb();
    return db.prepare('SELECT * FROM source_health').all();
  },

  // Ajustes
  getSetting(key, defaultValue = null) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },

  setSetting(key, value) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    return stmt.run(key, String(value));
  }
};
