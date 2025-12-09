import { Request, Response } from 'express';
import { Session, SessionData } from 'express-session';

import { ApolloServerPlugin } from '@apollo/server';

/**
 * Since the gateway handles session management,
 * subgraphs cannot mutate session data directly.
 * This plugin allows updates to session based on mutation response.
 */
export const sessionUpdatePlugin: ApolloServerPlugin<{
  req: Request;
  res: Response;
  session: Session & Partial<SessionData>;
}> = {
  async requestDidStart() {
    return {
      async willSendResponse({ contextValue, response }) {
        // Handle login: update session data based on mutation response
        if (
          response.body.kind === 'single' &&
          response.body.singleResult.data?.login
        ) {
          const loginResult = response.body.singleResult.data.login as any;

          // Update session
          contextValue.session.medusaToken = loginResult.token;
          contextValue.session.isCustomerLoggedIn =
            loginResult.isCustomerLoggedIn;

          // Save session
          await new Promise<void>((resolve, reject) =>
            contextValue.session.save((err) => (err ? reject(err) : resolve()))
          );
        }

        // Handle logout: destroy session and send a clearCookie response
        if (
          response.body.kind === 'single' &&
          (response.body.singleResult.data?.logout as any)?.success
        ) {
          await new Promise<void>((resolve, reject) =>
            contextValue.session.destroy((err) => {
              if (err) reject(err);
              else {
                contextValue.res.clearCookie('storefront.sid', {
                  httpOnly: true,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production',
                });
                resolve();
              }
            })
          );
        }
      },
    };
  },
};
