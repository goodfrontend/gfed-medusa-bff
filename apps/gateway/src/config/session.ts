import session from 'express-session';

import { redisStore } from './redis';

export const sessionConfig: (req: any, res: any, next: any) => void = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'storefront.sid',
  resave: false,
  saveUninitialized: false,
  store: process.env.NODE_ENV !== 'production' ? undefined : redisStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  },
});
