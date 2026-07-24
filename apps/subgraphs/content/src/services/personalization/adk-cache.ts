import { adkConfig } from '../../config/adk-config';
import {
  KEY_NS,
  getPersonalizationRedis,
} from '../../config/personalization-redis';

const CACHE_PREFIX = `${KEY_NS}adk:`;

function cacheKey(deviceId: string, surface: string): string {
  return `${CACHE_PREFIX}${deviceId}:${surface}`;
}

export async function getCachedDecision(
  deviceId: string,
  surface: string
): Promise<unknown | null> {
  const redis = await getPersonalizationRedis();
  const raw = await redis.get(cacheKey(deviceId, surface));
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

export async function setCachedDecision(
  deviceId: string,
  surface: string,
  data: unknown
): Promise<void> {
  const redis = await getPersonalizationRedis();
  await redis.set(cacheKey(deviceId, surface), JSON.stringify(data), {
    EX: adkConfig.cacheTtl(),
  });
}

export async function invalidateCachedDecision(
  deviceId: string
): Promise<void> {
  const redis = await getPersonalizationRedis();
  const pattern = `${CACHE_PREFIX}${deviceId}:*`;
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;
    if (result.keys.length > 0) {
      await redis.del(result.keys);
    }
  } while (cursor !== '0');
}
