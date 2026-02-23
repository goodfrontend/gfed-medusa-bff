import * as client from 'openid-client';

const server = new URL(process.env.AUTH_ISSUER as string);
const clientId = process.env.AUTH_CLIENT_ID as string;
const clientSecret = process.env.AUTH_CLIENT_SECRET;
const redirectUri = `${process.env.BFF_URL}/auth/callback`;
const scope = 'openid email profile';

export const getPKCE = async () => {
  /**
   * The following (code_verifier and potentially nonce) MUST be generated for
   * every redirect to the authorization_endpoint. You must store the
   * code_verifier and nonce in the end-user session such that it can be recovered
   * as the user gets redirected from the authorization server back to your
   * application.
   */
  const codeVerifier: string = client.randomPKCECodeVerifier();
  const codeChallenge: string =
    await client.calculatePKCECodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
};

export const getOpenIdConfigs = async ({
  codeChallenge,
  nonce,
}: {
  codeChallenge: string;
  nonce?: string;
}) => {
  const config = await client.discovery(
    server,
    clientId,
    clientSecret,
    undefined,
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          execute: [client.allowInsecureRequests],
        }
  );

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    ...(nonce ? { nonce } : undefined),
  };

  if (!config.serverMetadata().supportsPKCE() || !nonce) {
    /**
     * We cannot be sure the AS supports PKCE so we're going to use nonce too. Use
     * of PKCE is backwards compatible even if the AS doesn't support it which is
     * why we're using it regardless.
     */
    const newNonce = client.randomNonce();
    parameters.nonce = newNonce;
  }

  const redirectTo: URL = client.buildAuthorizationUrl(config, parameters);

  return { config, parameters, redirectTo };
};

export { client };
