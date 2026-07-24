import { type RedisClientType, createClient } from 'redis';

import { logger } from '../services/personalization/logger';

let client: RedisClientType | undefined;

/**
 * Dedicated Redis client for personalization (same REDIS_URL as gateway sessions).
 * Keys use namespace {@link KEY_NS} to avoid colliding with session or cache keys.
 */
export async function getPersonalizationRedis(): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      'REDIS_URL is required for personalization (content subgraph)'
    );
  }

  const next = createClient({
    url,
    socket: {
      connectTimeout: 10_000,
      timeout: 5_000,
      reconnectStrategy: (retries: number) => {
        if (retries > 5) {
          return new Error('Redis max reconnection attempts exceeded');
        }
        return Math.min(retries * 100, 2_000);
      },
    },
  });
  next.on('error', (err) => {
    logger.error(
      {
        err:
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : err,
      },
      'Personalization Redis error'
    );
  });
  await next.connect();
  client = next as RedisClientType;
  return client;
}

/** Prefix every personalization key with this segment. */
export const KEY_NS = 'bff:personalization:v1:';
