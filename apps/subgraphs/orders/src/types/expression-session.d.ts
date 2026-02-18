import 'express-session';

declare module 'express-session' {
  interface SessionData {
    medusaToken?: string;
    isCustomerLoggedIn?: boolean;
  }
}
