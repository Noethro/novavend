import { Worker } from 'bullmq';
import { loadWorkerConfig } from '@novavend/config';
import pino from 'pino';

const config = loadWorkerConfig(process.env);
const logger = pino({ level: config.LOG_LEVEL });

const worker = new Worker(
  'novavend-bootstrap',
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'bootstrap job received');
  },
  { connection: { url: config.REDIS_URL } },
);

worker.on('failed', (job, error) => {
  logger.error({ error, jobId: job?.id }, 'bootstrap job failed');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
