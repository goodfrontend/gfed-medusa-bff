import pino from 'pino';
import type { Logger } from 'pino';
import type { LoggerConfig } from '../types.js';

export type { Logger };

export function createLogger(config: LoggerConfig): Logger {
  const { serviceName, level = 'info', pretty = false, redactPaths = [] } = config;

  const pinoConfig: pino.LoggerOptions = {
    name: serviceName,
    level,
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'cookie',
        'apiKey',
        'secret',
        ...redactPaths,
      ],
      remove: true,
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty && process.env.NODE_ENV !== 'production') {
    return pino(
      pinoConfig,
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      })
    );
  }

  return pino(pinoConfig);
}

export function createChildLogger(
  logger: Logger,
  context: Record<string, unknown>
): Logger {
  return logger.child(context);
}

export * from '../types.js';
