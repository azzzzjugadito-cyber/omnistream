import fs from 'fs';
import path from 'path';
import { config } from './config.js';

if (!fs.existsSync(config.logsDir)) {
  fs.mkdirSync(config.logsDir, { recursive: true });
}

const APP_LOG = path.join(config.logsDir, 'app.log');
const ERROR_LOG = path.join(config.logsDir, 'error.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

let isDebug = config.logLevel === 'debug';

function rotateIfNeeded(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_LOG_SIZE) {
        const backup = `${filePath}.1`;
        if (fs.existsSync(backup)) {
          fs.unlinkSync(backup);
        }
        fs.renameSync(filePath, backup);
      }
    }
  } catch (err) {
    console.error('Error rotando log:', err);
  }
}

function writeToFile(filePath, level, message, meta) {
  try {
    rotateIfNeeded(filePath);
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (err) {
    console.error('Error escribiendo log:', err);
  }
}

export const logger = {
  setDebug(enabled) {
    isDebug = !!enabled;
    this.info(`Modo depuración ${isDebug ? 'ACTIVADO' : 'DESACTIVADO'}`);
  },

  isDebugEnabled() {
    return isDebug;
  },

  info(msg, meta) {
    console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`, meta || '');
    writeToFile(APP_LOG, 'info', msg, meta);
  },

  debug(msg, meta) {
    if (isDebug) {
      console.log(`\x1b[35m[DEBUG]\x1b[0m ${msg}`, meta || '');
      writeToFile(APP_LOG, 'debug', msg, meta);
    }
  },

  warn(msg, meta) {
    console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`, meta || '');
    writeToFile(APP_LOG, 'warn', msg, meta);
  },

  error(msg, meta) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`, meta || '');
    writeToFile(APP_LOG, 'error', msg, meta);
    writeToFile(ERROR_LOG, 'error', msg, meta);
  },

  getRecentLogs(limit = 100) {
    try {
      if (!fs.existsSync(APP_LOG)) return [];
      const content = fs.readFileSync(APP_LOG, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      return lines.slice(-limit);
    } catch (err) {
      return [`Error leyendo logs: ${err.message}`];
    }
  }
};
