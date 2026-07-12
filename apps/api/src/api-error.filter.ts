import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import {
  ApiErrorResponseSchema,
  type ApiValidationDetail,
} from '@novavend/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof response === 'object' && response !== null ? response : {};
    const rawMessages = 'message' in body ? body.message : undefined;
    const messages = Array.isArray(rawMessages)
      ? rawMessages.map(String)
      : rawMessages
        ? [String(rawMessages)]
        : [];
    const details: ApiValidationDetail[] | undefined =
      messages.length > 1
        ? messages.map((message) => ({ message }))
        : undefined;
    const fallbackMessage =
      status === 500 ? 'Internal server error' : 'Request failed';
    const message =
      messages[0] ??
      (typeof response === 'string' ? response : fallbackMessage);
    const errorName =
      'error' in body && typeof body.error === 'string'
        ? body.error
        : 'HTTP_ERROR';

    const error = ApiErrorResponseSchema.parse({
      code: errorName.toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_'),
      correlationId: request.id,
      details,
      message,
      status,
      timestamp: new Date().toISOString(),
    });
    void reply.status(status).send(error);
  }
}
