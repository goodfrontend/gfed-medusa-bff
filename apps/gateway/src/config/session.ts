import session from 'express-session';

import { redisStore } from './redis';

const isProd = process.env.NODE_ENV === 'production';

export const sessionConfig: (req: any, res: any, next: any) => void = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'storefront.sid',
  resave: false,
  saveUninitialized: false,
  store: isProd ? redisStore : undefined,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.justgood.win' : undefined,
    maxAge: 1000 * 60 * 60 * 24,
  },
});
