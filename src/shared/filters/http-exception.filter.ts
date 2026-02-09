import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

/**
 * Maps Prisma error codes to user-friendly HTTP responses.
 * Prevents raw database errors from leaking to API consumers.
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'The provided value is too long for the field' },
  P2001: { status: HttpStatus.NOT_FOUND, message: 'The requested record does not exist' },
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with this value already exists' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'The operation failed due to a missing related record' },
  P2004: { status: HttpStatus.BAD_REQUEST, message: 'A database constraint was violated' },
  P2005: { status: HttpStatus.BAD_REQUEST, message: 'Invalid value provided for the field' },
  P2006: { status: HttpStatus.BAD_REQUEST, message: 'The provided value is not valid' },
  P2011: { status: HttpStatus.BAD_REQUEST, message: 'A required field is missing a value' },
  P2014: { status: HttpStatus.BAD_REQUEST, message: 'The operation violates a required relation' },
  P2015: { status: HttpStatus.NOT_FOUND, message: 'A related record could not be found' },
  P2016: { status: HttpStatus.BAD_REQUEST, message: 'Query interpretation error' },
  P2021: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'A database table was not found' },
  P2022: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'A database column was not found' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'The requested record was not found' },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        errors = responseObj.errors || responseObj.error || [];

        // Handle class-validator errors
        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message;
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Handle known Prisma errors with user-friendly messages
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        status = mapped.status;
        message = mapped.message;
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'A database error occurred. Please try again later.';
      }

      // Add field context for unique constraint violations
      if (exception.code === 'P2002' && exception.meta?.target) {
        const fields = Array.isArray(exception.meta.target)
          ? (exception.meta.target as string[]).join(', ')
          : String(exception.meta.target);
        message = `A record with this ${fields} already exists`;
      }

      // Add context for not-found via P2025
      if (exception.code === 'P2025' && exception.meta?.cause) {
        message = String(exception.meta.cause);
      }

      this.logger.error(
        `Prisma error [${exception.code}]: ${exception.message}`,
        exception.stack,
        {
          correlationId: (request as any).correlationId,
          path: request.url,
          method: request.method,
          prismaCode: exception.code,
          prismaModel: exception.meta?.modelName || exception.meta?.target,
          prismaMeta: exception.meta,
          clientVersion: exception.clientVersion,
        },
      );
    } else if (exception instanceof PrismaClientValidationError) {
      // Handle Prisma validation errors (invalid query arguments)
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid request data. Please check your input and try again.';

      this.logger.error(
        `Prisma validation error: ${exception.message}`,
        exception.stack,
        {
          correlationId: (request as any).correlationId,
          path: request.url,
          method: request.method,
          clientVersion: exception.clientVersion,
        },
      );
    } else if (exception instanceof Error) {
      message = exception.message;

      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
        {
          correlationId: (request as any).correlationId,
          path: request.url,
          method: request.method,
        },
      );
    }

    const errorResponse: ApiResponse = {
      success: false,
      message,
      errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
      timestamp: new Date().toISOString(),
      correlationId: (request as any).correlationId,
    };

    // Log the error
    this.logger.error(
      `[${(request as any).correlationId}] ${request.method} ${request.url} - ${status} - ${message}`,
    );

    response.status(status).json(errorResponse);
  }
}
