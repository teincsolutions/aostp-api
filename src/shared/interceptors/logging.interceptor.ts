import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, correlationId } = request;
    const userAgent = request.get('user-agent') || '';
    const { ip } = request;

    const now = Date.now();

    this.logger.log(`[${correlationId}] ${method} ${url} - ${userAgent} ${ip}`);

    if (method !== 'GET' && body) {
      this.logger.debug(
        `[${correlationId}] Request body: ${JSON.stringify(body)}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.logger.log(
            `[${correlationId}] ${method} ${url} - ${response.statusCode} - ${responseTime}ms`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `[${correlationId}] ${method} ${url} - ${error.status || 500} - ${responseTime}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
