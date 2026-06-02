import Medusa from '@medusajs/js-sdk';

let medusaInstance: Medusa | null = null;

export function getMedusaClient(): Medusa {
  if (medusaInstance) return medusaInstance;

  medusaInstance = new Medusa({
    baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
    publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY || '',
  });

  return medusaInstance;
}

export function resetMedusaClient(): void {
  medusaInstance = null;
}
