import { HttpResponse, http } from 'msw';

import { createMockPaymentProviders } from '@mocks/payment';

export const handlers = [
  http.get(`${process.env.MEDUSA_API_URL}/store/payment-providers`, () => {
    return HttpResponse.json({
      payment_providers: createMockPaymentProviders(),
    });
  }),

  http.post(`${process.env.MEDUSA_API_URL}/store/payment-collections`, () => {
    return HttpResponse.json({
      payment_collection: { id: 'pc_123' },
    });
  }),

  http.post(
    `${process.env.MEDUSA_API_URL}/store/payment-collections/:id/payment-sessions`,
    () => {
      return HttpResponse.json({
        payment_collection: {
          id: 'pc_123',
          payment_sessions: [{ id: 'ps_123', provider_id: 'pp_stripe_stripe' }],
        },
      });
    }
  ),
];

export const paymentProvidersErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/payment-providers`,
  () => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);
