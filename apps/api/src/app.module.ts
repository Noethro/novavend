import { Module } from '@nestjs/common';
import { loadApiConfig } from '@novavend/config';
import { createDatabase } from '@novavend/database';
import Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AuthController, OnboardingController } from './auth.controller';
import { AuthenticationGuard } from './auth.guard';
import { AvatarPairingService } from './avatar-pairing.service';
import {
  SecondLifeAvatarPairingController,
  WorkspaceAvatarController,
} from './avatar-pairing.controller';
import { WorkspaceAccessService } from './workspace-access.service';
import { AuthService } from './auth.service';
import {
  HealthService,
  POSTGRES_HEALTH_CHECK,
  REDIS_HEALTH_CHECK,
} from './health.service';
import {
  DATABASE_RESOURCE,
  InfrastructureService,
  REDIS_RESOURCE,
  type DatabaseResource,
} from './infrastructure.service';

const config = loadApiConfig(process.env);

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (request) => ({ correlationId: request.id }),
        level: config.LOG_LEVEL,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
        ],
      },
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    OnboardingController,
    WorkspaceAvatarController,
    SecondLifeAvatarPairingController,
  ],
  providers: [
    AuthService,
    AuthenticationGuard,
    AvatarPairingService,
    WorkspaceAccessService,
    HealthService,
    InfrastructureService,
    {
      provide: DATABASE_RESOURCE,
      useFactory: () => createDatabase(config.DATABASE_URL),
    },
    {
      provide: REDIS_RESOURCE,
      useFactory: () =>
        new Redis(config.REDIS_URL, {
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }),
    },
    {
      provide: POSTGRES_HEALTH_CHECK,
      inject: [DATABASE_RESOURCE],
      useFactory: (database: DatabaseResource) => () =>
        database.checkConnectivity(),
    },
    {
      provide: REDIS_HEALTH_CHECK,
      inject: [REDIS_RESOURCE],
      useFactory: (redis: Redis) => async () => {
        if (redis.status === 'wait') await redis.connect();
        await redis.ping();
      },
    },
  ],
})
export class AppModule {}
