import 'express-session';

declare module 'express-session' {
  interface SessionData {
    authId?: string;
    customerId?: string;
    isCustomerLoggedIn?: boolean;
    medusaToken?: string;
    pkce?: {
      codeChallenge?: string;
      codeVerifier?: string;
      nonce?: string;
    };
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  }
}
