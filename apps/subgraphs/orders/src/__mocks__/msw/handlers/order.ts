import { HttpResponse, http } from 'msw';

import { createMockOrder } from '@mocks/order';

const BASE = process.env.MEDUSA_API_URL;

export const handlers = [
  http.get(`${BASE}/store/orders/:id`, () => {
    return HttpResponse.json({ order: createMockOrder() });
  }),

  http.get(`${BASE}/store/orders`, () => {
    return HttpResponse.json({
      orders: [createMockOrder()],
      count: 1,
      limit: 10,
      offset: 0,
    });
  }),

  http.post(`${BASE}/store/orders/:id/transfer/request`, () => {
    return HttpResponse.json({ order: createMockOrder() });
  }),

  http.post(`${BASE}/store/orders/:id/transfer/accept`, () => {
    return HttpResponse.json({ order: createMockOrder() });
  }),

  http.post(`${BASE}/store/orders/:id/transfer/decline`, () => {
    return HttpResponse.json({ order: createMockOrder() });
  }),
];

export const orderNotFoundHandler = http.get(
  `${BASE}/store/orders/:id`,
  () => HttpResponse.json({ message: 'Order not found' }, { status: 404 })
);

export const orderServerErrorHandler = http.get(
  `${BASE}/store/orders/:id`,
  () => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);

export const transferErrorHandler = http.post(
  `${BASE}/store/orders/:id/transfer/request`,
  () => HttpResponse.json({ message: 'Transfer failed' }, { status: 422 })
);
