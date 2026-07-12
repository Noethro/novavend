import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiErrorFilter } from './api-error.filter';
import { CORRELATION_ID_HEADER, resolveCorrelationId } from './correlation';

export const configureApi = (
  app: INestApplication,
  nodeEnvironment: 'development' | 'test' | 'production',
  allowedWebOrigin = 'http://localhost:3000',
): void => {
  app.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    origin: allowedWebOrigin,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());

  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook('onRequest', (request, reply, done) => {
    const correlationId = resolveCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );
    (request as FastifyRequest & { id: string }).id = correlationId;
    request.log = request.log.child({ correlationId });
    void reply.header(CORRELATION_ID_HEADER, correlationId);
    done();
  });

  if (nodeEnvironment === 'development') {
    const options = new DocumentBuilder()
      .setTitle('NovaVend API')
      .setDescription('NovaVend repository-bootstrap API')
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, options),
    );
  }
};
