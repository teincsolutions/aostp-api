import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_ID_HEADER } from '../constants';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get or generate correlation ID
    const correlationId = request.headers[CORRELATION_ID_HEADER] || uuidv4();

    // Attach to request object
    request.correlationId = correlationId;

    // Add to response headers
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    return next.handle().pipe(
      map((data) => {
        // Add correlation ID to response body if it's an object
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return {
            ...data,
            correlationId,
          };
        }
        return data;
      }),
    );
  }
}
