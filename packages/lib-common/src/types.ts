import type { Logger } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggerConfig {
  serviceName: string;
  level?: LogLevel;
  pretty?: boolean;
  redactPaths?: string[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version?: string;
  checks?: Record<string, {
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    latency?: number;
  }>;
}

export interface AppContext {
  logger: Logger;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface ErrorDetails {
  code?: string;
  statusCode?: number;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
}
