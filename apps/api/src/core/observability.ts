import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const counters = new Map<string, number>();
const durations = new Map<string, { count: number; sum: number }>();

function key(method: string, route: string, status: number) { return `${method}|${route}|${status}`; }
function escape(value: string) { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'); }

export function jsonLog(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'kz-erp-api', message, ...fields })}\n`);
}

export function observabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : (res.statusCode === 404 ? '__not_found__' : req.baseUrl || '__unmatched__');
    const metricKey = key(req.method, route, res.statusCode);
    counters.set(metricKey, (counters.get(metricKey) ?? 0) + 1);
    const duration = durations.get(route) ?? { count: 0, sum: 0 };
    duration.count += 1;
    duration.sum += elapsed;
    durations.set(route, duration);
    jsonLog(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'http_request', {
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Number(elapsed.toFixed(3)),
      userAgent: req.get('user-agent') ?? undefined
    });
  });
  next();
}

export function metricsText() {
  const lines = [
    '# HELP kz_erp_http_requests_total Total HTTP requests.',
    '# TYPE kz_erp_http_requests_total counter'
  ];
  for (const [metricKey, value] of counters) {
    const [method, route, status] = metricKey.split('|');
    lines.push(`kz_erp_http_requests_total{method="${escape(method ?? '')}",route="${escape(route ?? '')}",status="${escape(status ?? '')}"} ${value}`);
  }
  lines.push('# HELP kz_erp_http_request_duration_ms_sum Sum of HTTP request durations in milliseconds.', '# TYPE kz_erp_http_request_duration_ms_sum counter');
  for (const [route, value] of durations) lines.push(`kz_erp_http_request_duration_ms_sum{route="${escape(route)}"} ${value.sum}`);
  lines.push('# HELP kz_erp_http_request_duration_ms_count Count of HTTP request durations.', '# TYPE kz_erp_http_request_duration_ms_count counter');
  for (const [route, value] of durations) lines.push(`kz_erp_http_request_duration_ms_count{route="${escape(route)}"} ${value.count}`);
  return `${lines.join('\n')}\n`;
}
