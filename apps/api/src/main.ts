import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { loadApiConfig } from '@novavend/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApi } from './configure-api';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 8192 }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  configureApi(app, config.NODE_ENV, config.API_ALLOWED_WEB_ORIGIN);
  app.enableShutdownHooks();
  await app.listen(config.API_PORT, '0.0.0.0');
}

void bootstrap();
