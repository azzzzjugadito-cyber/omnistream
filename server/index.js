import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { logger } from './logger.js';
import { getDb } from './db.js';
import { sourceManager } from './sources/index.js';
import { startHealthChecker } from './health.js';

import liveRouter from './routes/live.js';
import vodRouter from './routes/vod.js';
import searchRouter from './routes/search.js';
import userRouter from './routes/user.js';
import proxyRouter from './routes/proxy.js';
import settingsRouter from './routes/settings.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Logging de peticiones HTTP en modo depuración
app.use((req, res, next) => {
  if (logger.isDebugEnabled() && !req.path.startsWith('/api/proxy')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Rutas de API
app.use('/api/live', liveRouter);
app.use('/api/vod', vodRouter);
app.use('/api/search', searchRouter);
app.use('/api/user', userRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/settings', settingsRouter);

// Servir frontend compilado si existe en producción
const clientDist = path.join(config.rootDir, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // En modo desarrollo, mensaje informativo en raíz
  app.get('/', (req, res) => {
    res.json({
      status: 'OmniStream OTT Backend activo',
      version: '1.0.0',
      apiDocs: '/api/settings/info',
      frontendDevUrl: 'http://localhost:3000'
    });
  });
}

// Inicialización de subsistemas
async function bootstrap() {
  try {
    // 1. Inicializar base de datos SQLite
    getDb();

    // 2. Cargar fuentes declarativas desde sources.yaml
    await sourceManager.loadFromYaml();

    // 3. Arrancar comprobador de salud en segundo plano
    startHealthChecker();

    // 4. Iniciar servidor Express
    app.listen(config.port, config.host, () => {
      logger.info('=====================================================');
      logger.info('🚀 OmniStream OTT Aggregator Backend Listo');
      logger.info(`📡 Local:    http://127.0.0.1:${config.port}`);
      logger.info(`📱 Red LAN:  http://${config.host}:${config.port}`);
      logger.info(`⚙️  Fuentes:  ${config.sourcesFile}`);
      logger.info('=====================================================');
    });
  } catch (err) {
    logger.error(`Error crítico iniciando servidor: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();
