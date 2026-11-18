import { sourceManager } from './sources/index.js';
import { dbService } from './db.js';
import { logger } from './logger.js';
import { config } from './config.js';

let intervalTimer = null;

export async function runHealthChecks() {
  logger.info('Iniciando ronda de comprobación de salud de fuentes en segundo plano...');
  const results = [];

  for (const [id, adapter] of sourceManager.adapters.entries()) {
    try {
      const health = await adapter.checkHealth();
      dbService.saveSourceHealth(id, health.status, health.latencyMs, health.error);
      results.push({
        sourceId: id,
        name: adapter.name,
        type: adapter.type,
        ...health
      });
      logger.info(`Salud de fuente [${id}]: ${health.status.toUpperCase()} (${health.latencyMs}ms)${health.error ? ` - ${health.error}` : ''}`);
    } catch (err) {
      dbService.saveSourceHealth(id, 'offline', 0, err.message);
      results.push({
        sourceId: id,
        name: adapter.name,
        status: 'offline',
        latencyMs: 0,
        error: err.message
      });
      logger.error(`Error comprobando fuente ${id}: ${err.message}`);
    }
  }

  return results;
}

export function startHealthChecker() {
  const intervalMs = Math.max(1, config.healthCheckIntervalMinutes) * 60 * 1000;
  logger.info(`Comprobador de salud programado cada ${config.healthCheckIntervalMinutes} minutos.`);

  // Primera ejecución tras 10 segundos para no entorpecer el arranque
  setTimeout(() => {
    runHealthChecks().catch(err => logger.error(`Error en primer healthcheck: ${err.message}`));
  }, 10000);

  // Intervalo periódico
  intervalTimer = setInterval(() => {
    runHealthChecks().catch(err => logger.error(`Error en healthcheck periódico: ${err.message}`));
  }, intervalMs);
}

export function stopHealthChecker() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
