import type { WorkerConfig } from '@novavend/config';
import { Worker } from 'bullmq';
import type { Logger } from 'pino';
import type { WorkerHealthIndicator } from './worker-health';

interface SampleWorkerDependencies {
  health: WorkerHealthIndicator;
  logger: Logger;
  workerFactory?: typeof Worker;
}

export const createSampleWorker = (
  config: WorkerConfig,
  dependencies: SampleWorkerDependencies,
): Worker | undefined => {
  if (!config.ENABLE_SAMPLE_WORKER) return undefined;

  const WorkerFactory = dependencies.workerFactory ?? Worker;
  const worker = new WorkerFactory(
    'novavend-bootstrap',
    async (job) => {
      dependencies.health.recordHeartbeat();
      dependencies.logger.info(
        { jobId: job.id, jobName: job.name },
        'sample bootstrap job received',
      );
    },
    { connection: { url: config.REDIS_URL } },
  );
  dependencies.health.markRunning();
  worker.on('failed', (job, error) => {
    dependencies.logger.error(
      { error, jobId: job?.id },
      'sample bootstrap job failed',
    );
  });
  return worker;
};
