import { Injectable, Logger } from '@nestjs/common';
import * as winston from 'winston';
import { UploadsService } from '../../modules/uploads/uploads.service';
import { createWinstonLogger } from './s3-transport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoggingService {
  private winstonLogger: winston.Logger;
  private readonly nestLogger = new Logger('LoggingService');

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService,
  ) {
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

  // Helper to save activity log
  private async saveActivityLog(
    level: string,
    message: string,
    meta?: any,
  ): Promise<void> {
    try {
      const logData: any = {
        level,
        message,
        correlationId: meta?.correlationId,
        userId: meta?.userId || meta?.correlationId ? null : undefined, // if no correlationId, it might be system
        ipAddress: meta?.ip || meta?.ipAddress,
        userAgent: meta?.userAgent,
        method: meta?.method,
        url: meta?.url,
        statusCode: meta?.statusCode,
        responseTime: meta?.responseTime,
        error: meta?.error,
      };

      // Clean up undefined values
      Object.keys(logData).forEach((key) => {
        if (logData[key] === undefined) delete logData[key];
      });

      if (meta && Object.keys(meta).length > 0) {
        logData.metadata = { ...meta };
        // Remove fields already in top level
        delete logData.metadata.correlationId;
        delete logData.metadata.userId;
        delete logData.metadata.ip;
        delete logData.metadata.ipAddress;
        delete logData.metadata.method;
        delete logData.metadata.url;
        delete logData.metadata.statusCode;
        delete logData.metadata.responseTime;
        delete logData.metadata.userAgent;
        delete logData.metadata.error;
        if (Object.keys(logData.metadata).length === 0) {
          delete logData.metadata;
        }
      }

      await this.prisma.activityLog.create({
        data: logData,
      });
    } catch (err) {
      // Silent fail for logging
      this.nestLogger.error(
        'Failed to save activity log to database',
        err.message,
      );
    }
  }

  // Method to log error level
  error(message: string, meta?: any): void {
    this.winstonLogger.error(message, meta);
    // Save to database asynchronously
    this.saveActivityLog('error', message, meta);
  }

  // Method to log warn level
  warn(message: string, meta?: any): void {
    this.winstonLogger.warn(message, meta);
    // Save to database asynchronously
    this.saveActivityLog('warn', message, meta);
  }

  // Method to log info level
  info(message: string, meta?: any): void {
    this.winstonLogger.info(message, meta);
    // Save to database asynchronously
    this.saveActivityLog('info', message, meta);
  }

  // Method to log debug level
  debug(message: string, meta?: any): void {
    this.winstonLogger.debug(message, meta);
    // Save to database asynchronously
    this.saveActivityLog('debug', message, meta);
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
