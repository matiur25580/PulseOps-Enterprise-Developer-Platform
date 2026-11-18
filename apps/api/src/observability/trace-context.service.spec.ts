import { TraceContextService } from './trace-context.service';

describe('TraceContextService', () => {
  const context = { traceId: '0123456789abcdef0123456789abcdef', spanId: '0123456789abcdef', traceFlags: '01' };

  it('propagates the active W3C trace context to outbound headers', () => {
    const service = new TraceContextService();
    const headers = service.run(context, () => service.inject({ authorization: 'Bearer test' }));
    expect(headers).toEqual({
      authorization: 'Bearer test',
      traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    });
  });

  it('does not invent trace context outside an active request', () => {
    const service = new TraceContextService();
    expect(service.inject({ accept: 'application/json' })).toEqual({ accept: 'application/json' });
  });

  it('isolates concurrent asynchronous contexts', async () => {
    const service = new TraceContextService();
    const second = { ...context, traceId: 'abcdef0123456789abcdef0123456789' };
    const results = await Promise.all([
      service.run(context, async () => { await Promise.resolve(); return service.current()?.traceId; }),
      service.run(second, async () => { await Promise.resolve(); return service.current()?.traceId; }),
    ]);
    expect(results).toEqual([context.traceId, second.traceId]);
  });
});
