export interface WorkerHealth {
  lastHeartbeat: string | null;
  running: boolean;
  status: 'healthy' | 'stopped';
}

export class WorkerHealthIndicator {
  private lastHeartbeat: Date | null = null;
  private running = false;

  markRunning(): void {
    this.running = true;
    this.recordHeartbeat();
  }

  markStopped(): void {
    this.running = false;
  }

  recordHeartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  getHealth(): WorkerHealth {
    return {
      lastHeartbeat: this.lastHeartbeat?.toISOString() ?? null,
      running: this.running,
      status: this.running ? 'healthy' : 'stopped',
    };
  }
}
