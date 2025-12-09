import session from 'express-session';

// NOTE: For development only
// TODO: Use Redis for production or deployed environments
export const sessionConfig: (req: any, res: any, next: any) => void = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'storefront.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  },
});
