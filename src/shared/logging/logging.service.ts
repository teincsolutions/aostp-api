import { Injectable, Logger } from '@nestjs/common';
import * as winston from 'winston';
import { UploadsService } from '../../modules/uploads/uploads.service';
import { createWinstonLogger } from './s3-transport';

@Injectable()
export class LoggingService {
  private winstonLogger: winston.Logger;
  private readonly nestLogger = new Logger('LoggingService');

  constructor(private readonly uploadsService: UploadsService) {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const uploadIntervalMinutes = parseInt(
      process.env.LOG_UPLOAD_INTERVAL_MINUTES || '60',
      10,
    );
    this.winstonLogger = createWinstonLogger(
      this.uploadsService,
      logLevel,
      uploadIntervalMinutes,
    );
    this.nestLogger.log(
      `Winston logger initialized with level: ${logLevel}, upload interval: ${uploadIntervalMinutes} minutes`,
    );
  }

  // Method to log error level
  error(message: string, meta?: any): void {
    this.winstonLogger.error(message, meta);
  }

  // Method to log warn level
  warn(message: string, meta?: any): void {
    this.winstonLogger.warn(message, meta);
  }

  // Method to log info level
  info(message: string, meta?: any): void {
    this.winstonLogger.info(message, meta);
  }

  // Method to log debug level
  debug(message: string, meta?: any): void {
    this.winstonLogger.debug(message, meta);
  }

  // Method to log http requests specifically
  logHttpRequest(request: any, responseTime: number, statusCode: number): void {
    const message = `[${request.correlationId}] ${request.method} ${request.url} - ${statusCode} - ${responseTime}ms`;
    this.info(message, {
      correlationId: request.correlationId,
      method: request.method,
      url: request.url,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      statusCode,
      responseTime,
    });
  }

  // Method to log http request with body (for POST/PUT/PATCH)
  logHttpRequestWithBody(
    request: any,
    responseTime: number,
    statusCode: number,
  ): void {
    const message = `[${request.correlationId}] ${request.method} ${request.url} - ${statusCode} - ${responseTime}ms`;
    this.info(message, {
      correlationId: request.correlationId,
      method: request.method,
      url: request.url,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      statusCode,
      responseTime,
      body: request.method !== 'GET' ? request.body : undefined,
    });
  }

  // Method to log errors
  logHttpError(error: any, request: any, responseTime: number): void {
    const message = `[${request.correlationId}] ${request.method} ${request.url} - ${error.status || 500} - ${responseTime}ms - ${error.message}`;
    this.error(message, {
      correlationId: request.correlationId,
      method: request.method,
      url: request.url,
      statusCode: error.status || 500,
      responseTime,
      error: error.message,
      stack: error.stack,
    });
  }

  // Get the underlying winston logger if needed
  getWinstonLogger(): winston.Logger {
    return this.winstonLogger;
  }
}
