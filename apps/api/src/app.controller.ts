import { Controller, Get } from '@nestjs/common';
import { HealthResponseSchema, type HealthResponse } from '@novavend/contracts';

@Controller()
export class AppController {
  @Get('health')
  health(): HealthResponse {
    return HealthResponseSchema.parse({ service: 'api', status: 'ok' });
  }
}
