import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, correlationId } = request;
    const userAgent = request.get('user-agent') || '';
    const { ip } = request;

    const now = Date.now();

    // Log request with basic info
    this.loggingService.info(
      `[${correlationId}] ${method} ${url} - ${userAgent} ${ip}`,
      {
        correlationId,
        method,
        url,
        userAgent,
        ip,
      },
    );

    if (method !== 'GET' && body) {
      // Log request with body for non-GET requests
      this.loggingService.debug(`[${correlationId}] Request body`, {
        correlationId,
        body: JSON.stringify(body),
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.loggingService.logHttpRequest(
            request,
            responseTime,
            response.statusCode,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.loggingService.logHttpError(error, request, responseTime);
        },
      }),
    );
  }
}
