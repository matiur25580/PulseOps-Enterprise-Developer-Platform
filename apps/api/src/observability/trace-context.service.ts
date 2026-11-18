import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type ActiveTraceContext = {
  traceId: string;
  spanId: string;
  traceFlags: string;
};

@Injectable()
export class TraceContextService {
  private readonly storage = new AsyncLocalStorage<ActiveTraceContext>();

  run<T>(context: ActiveTraceContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current(): ActiveTraceContext | undefined {
    return this.storage.getStore();
  }

  inject(headers: Record<string, string> = {}): Record<string, string> {
    const context = this.current();
    if (!context) return headers;
    return { ...headers, traceparent: `00-${context.traceId}-${context.spanId}-${context.traceFlags}` };
  }
}
