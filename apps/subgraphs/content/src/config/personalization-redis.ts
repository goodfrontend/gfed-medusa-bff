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

  const next = createClient({ url });
  next.on('error', (err) => {
    logger.error({ err }, 'Personalization Redis error');
  });
  await next.connect();
  client = next as RedisClientType;
  return client;
}

/** Prefix every personalization key with this segment. */
export const KEY_NS = 'bff:personalization:v1:';
