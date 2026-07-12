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
    const exceptionStatus =
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      typeof exception.statusCode === 'number'
        ? exception.statusCode
        : undefined;
    const isClaimBodyTooLarge =
      request.url.split('?')[0] === '/secondlife/v1/avatar-pairings/claim' &&
      (exceptionStatus === HttpStatus.PAYLOAD_TOO_LARGE ||
        (exception instanceof HttpException &&
          exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE));
    const status = isClaimBodyTooLarge
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : (exceptionStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
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
    const message = isClaimBodyTooLarge
      ? 'Request is too large'
      : (messages[0] ??
        (typeof response === 'string' ? response : fallbackMessage));
    const errorName = isClaimBodyTooLarge
      ? 'PROTOCOL_BODY_TOO_LARGE'
      : 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'HTTP_ERROR';

    if (
      status === 429 &&
      'retryAfter' in body &&
      typeof body.retryAfter === 'number'
    ) {
      void reply.header('retry-after', String(body.retryAfter));
    }

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
