import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

let redisStore: RedisStore | undefined = undefined;

if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
  const redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on('connect', () =>
    console.log('Connected to Redis for sessions')
  );
  redisClient.on('error', (err) => console.error('Redis error:', err));

  redisClient.connect();

  redisStore = new RedisStore({
    client: redisClient,
  });
}

export { redisStore };
