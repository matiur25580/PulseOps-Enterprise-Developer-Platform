import { Injectable } from '@nestjs/common';
type MetricRow = { count: number; durationSeconds: number; buckets: number[] };
const BOUNDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
@Injectable()
export class MetricsService {
  private readonly rows = new Map<string, MetricRow>();
  record(method: string, route: string, status: number, durationSeconds: number) {
    const key = JSON.stringify([method, route, String(status)]);
    const row = this.rows.get(key) ?? { count: 0, durationSeconds: 0, buckets: BOUNDS.map(() => 0) };
    row.count++; row.durationSeconds += durationSeconds;
    BOUNDS.forEach((bound, index) => { if (durationSeconds <= bound) row.buckets[index]++; });
    this.rows.set(key, row);
  }
  render(): string {
    const lines = [
      '# HELP pulseops_http_requests_total Total HTTP requests handled by this API process.',
      '# TYPE pulseops_http_requests_total counter',
      '# HELP pulseops_http_request_duration_seconds_sum Total request duration in seconds.',
      '# TYPE pulseops_http_request_duration_seconds_sum counter',
      '# HELP pulseops_http_request_duration_seconds_count Number of requests observed.',
      '# TYPE pulseops_http_request_duration_seconds_count counter',
      '# HELP pulseops_http_request_duration_seconds_bucket Request duration histogram buckets.',
      '# TYPE pulseops_http_request_duration_seconds_bucket histogram',
    ];
    for (const [key, row] of this.rows) {
      const [method, route, status] = JSON.parse(key) as string[];
      const labels = `method="${this.escape(method)}",route="${this.escape(route)}",status="${status}"`;
      lines.push(`pulseops_http_requests_total{${labels}} ${row.count}`);
      lines.push(`pulseops_http_request_duration_seconds_sum{${labels}} ${row.durationSeconds}`);
      lines.push(`pulseops_http_request_duration_seconds_count{${labels}} ${row.count}`);
      BOUNDS.forEach((bound, index) => lines.push(`pulseops_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${row.buckets[index]}`));
      lines.push(`pulseops_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${row.count}`);
    }
    lines.push(`process_uptime_seconds ${process.uptime()}`);
    return lines.join('\n') + '\n';
  }
  private escape(value: string) { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
}
