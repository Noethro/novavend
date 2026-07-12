import { loadWorkerConfig } from '@novavend/config';
import pino from 'pino';
import { WorkerHealthIndicator } from './worker-health';
import { createSampleWorker } from './sample-worker';

const config = loadWorkerConfig(process.env);
const logger = pino({ level: config.LOG_LEVEL });
const health = new WorkerHealthIndicator();
const worker = createSampleWorker(config, { health, logger });

if (!worker) logger.info('sample worker processor is disabled');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  health.markStopped();
  if (worker) await worker.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
