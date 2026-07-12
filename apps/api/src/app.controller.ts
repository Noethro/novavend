import { Controller, Get, Res } from '@nestjs/common';
import {
  HealthResponseSchema,
  ReadinessResponseSchema,
  type HealthResponse,
  type ReadinessResponse,
} from '@novavend/contracts';
import type { FastifyReply } from 'fastify';
import { HealthService } from './health.service';

@Controller('health')
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  live(): HealthResponse {
    return HealthResponseSchema.parse({ service: 'api', status: 'ok' });
  }

  @Get('ready')
  async ready(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ReadinessResponse> {
    const readiness = await this.healthService.checkReadiness();
    if (readiness.status === 'unhealthy') reply.status(503);
    return ReadinessResponseSchema.parse(readiness);
  }
}
