import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  tmdbApiKey: process.env.TMDB_API_KEY && process.env.TMDB_API_KEY !== 'YOUR_TMDB_API_KEY_HERE' 
    ? process.env.TMDB_API_KEY 
    : null,
  theSportsDbKey: process.env.THESPORTSDB_API_KEY || '123',
  logLevel: process.env.LOG_LEVEL || 'info',
  healthCheckIntervalMinutes: parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '5', 10),
  
  // Paths
  rootDir: ROOT_DIR,
  logsDir: path.join(ROOT_DIR, 'logs'),
  dataDir: path.join(ROOT_DIR, 'data'),
  sourcesFile: path.join(ROOT_DIR, 'sources.yaml'),
  dbFile: path.join(ROOT_DIR, 'data', 'app.db')
};
