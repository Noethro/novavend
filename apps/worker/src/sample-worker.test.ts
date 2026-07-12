import { loadWorkerConfig } from '@novavend/config';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createSampleWorker } from './sample-worker';
import { WorkerHealthIndicator } from './worker-health';

describe('sample worker processor', () => {
  it('is disabled by default and does not construct a worker', () => {
    const workerFactory = vi.fn();
    const config = loadWorkerConfig({
      DATABASE_URL: 'postgresql://localhost/novavend',
      REDIS_URL: 'redis://localhost:6379',
    });
    const worker = createSampleWorker(config, {
      health: new WorkerHealthIndicator(),
      logger: pino({ enabled: false }),
      workerFactory: workerFactory as never,
    });

    expect(worker).toBeUndefined();
    expect(workerFactory).not.toHaveBeenCalled();
  });
});
