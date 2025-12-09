import { HttpResponse, http } from 'msw';

import { createMockCustomer, mockLoginToken } from '@mocks/customer';

/* Success (i.e. happy path) handlers */
export const handlers = [
  http.post(`${process.env.MEDUSA_API_URL}/auth/customer/emailpass`, () =>
    HttpResponse.json({
      token: mockLoginToken,
      isCustomerLoggedIn: true,
    })
  ),
  http.get(`${process.env.MEDUSA_API_URL}/store/customers/me`, () =>
    HttpResponse.json({ customer: createMockCustomer() })
  ),
];

export const internalServerErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/customers/me`,
  () => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);

export const invalidLoginHandler = http.post(
  `${process.env.MEDUSA_API_URL}/auth/customer/emailpass`,
  () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
);
