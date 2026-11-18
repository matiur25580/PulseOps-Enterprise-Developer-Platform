import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';
@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = process.hrtime.bigint();
    const route = (request.route?.path as string | undefined) ?? request.path ?? 'unknown';
    const traceparent = request.header('traceparent') ?? '';
    const traceId = /^\d{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent)?.[1] ?? randomUUID().replace(/-/g, '');
    response.setHeader('x-trace-id', traceId);
    return next.handle().pipe(finalize(() => {
      const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
      const status = response.statusCode || 500;
      if (route !== '/metrics') this.metrics.record(request.method, route, status, durationSeconds);
      process.stdout.write(JSON.stringify({ level: status >= 500 ? 'error' : 'info', event: 'http.server.request', traceId, method: request.method, route, status, durationMs: Number((durationSeconds * 1000).toFixed(2)) }) + '\n');
    }));
  }
}
