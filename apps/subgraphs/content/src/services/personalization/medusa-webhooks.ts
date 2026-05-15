import crypto from 'node:crypto';

function requireWebhookSecret(): string {
  const secret = process.env.PERSONALIZATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'PERSONALIZATION_WEBHOOK_SECRET is required for Medusa personalization webhooks'
    );
  }
  return secret;
}

function medusaBaseUrl(): string {
  const base = process.env.MEDUSA_API_URL?.trim().replace(/\/$/, '');
  if (!base) {
    throw new Error('MEDUSA_API_URL is required for personalization webhooks');
  }
  return base;
}

export function signPersonalizationBody(body: string): string {
  return crypto
    .createHmac('sha256', requireWebhookSecret())
    .update(body)
    .digest('hex');
}

export async function postPersonalizationWebhook(
  path: string,
  payload: unknown
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPersonalizationBody(body);
  const url = `${medusaBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-personalization-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Medusa personalization webhook failed: ${response.status} ${response.statusText} ${text}`
    );
  }
}

export const MEDUSA_PERSONALIZATION_PATHS = {
  signals: '/webhooks/personalization/signals',
  conversions: '/webhooks/personalization/conversions',
} as const;
