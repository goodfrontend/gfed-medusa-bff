import crypto from 'node:crypto';

import { logger } from './logger';

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

function signPersonalizationBody(body: string): string {
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

  logger.info({ path, url }, 'Webhook POST starting');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-personalization-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    logger.error(
      { path, statusCode: response.status, statusText: response.statusText },
      'Webhook POST failed'
    );
    const text = await response.text();
    throw new Error(
      `Medusa personalization webhook failed: ${response.status} ${response.statusText} ${text}`
    );
  }

  logger.info(
    { path, statusCode: response.status },
    'Webhook POST succeeded'
  );
}

export const MEDUSA_PERSONALIZATION_PATHS = {
  signals: '/webhooks/personalization/signals',
  conversions: '/webhooks/personalization/conversions',
} as const;
