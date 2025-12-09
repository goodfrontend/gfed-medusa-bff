import pino from 'pino';

import { type LogLevel, createLogger } from '@gfed-medusa/bff-lib-common';

export const logger: pino.Logger = createLogger({
  serviceName: 'customers-subgraph',
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.NODE_ENV === 'development',
});
