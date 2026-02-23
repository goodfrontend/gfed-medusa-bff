import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import {
  PrefixingKeyValueCache,
  type KeyValueCache,
} from '@apollo/utils.keyvaluecache';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

const redisUrl = process.env.REDIS_URL;
const cacheNamespace = process.env.CACHE_NAMESPACE || 'bff:cache:v1:';
const cacheDebug = process.env.CACHE_DEBUG === 'true';

let responseCache: KeyValueCache | undefined;

if (redisUrl || cacheDebug) {
  const keyv = redisUrl
    ? new Keyv({
        store: new KeyvRedis({ url: redisUrl }),
        namespace: '',
      })
    : new Keyv({ namespace: '' });

  keyv.on('error', (err) => console.error('Keyv cache error:', err));

  const baseCache = new KeyvAdapter(keyv, { disableBatchReads: true });
  responseCache =
    cacheNamespace && cacheNamespace.length > 0
      ? new PrefixingKeyValueCache(baseCache, cacheNamespace)
      : baseCache;
}

export { responseCache };
