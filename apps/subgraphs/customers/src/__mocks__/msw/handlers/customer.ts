import { HttpResponse, http } from 'msw';

import {
  createMockCustomer,
  mockLoginToken,
  mockRegisterToken,
} from '@mocks/customer';

/* Success (i.e. happy path) handlers */
export const handlers = [
  // Login handler (POST /auth/customer/emailpass)
  http.post(`${process.env.MEDUSA_API_URL}/auth/customer/emailpass`, () =>
    HttpResponse.json({
      token: mockLoginToken,
    })
  ),

  // Register handler (POST /auth/customer/emailpass/register)
  http.post(
    `${process.env.MEDUSA_API_URL}/auth/customer/emailpass/register`,
    () =>
      HttpResponse.json({
        token: mockRegisterToken,
      })
  ),

  // Create customer handler (POST /store/customers)
  http.post(`${process.env.MEDUSA_API_URL}/store/customers`, () =>
    HttpResponse.json({ customer: createMockCustomer() })
  ),

  // Get current customer handler (GET /store/customers/me)
  http.get(`${process.env.MEDUSA_API_URL}/store/customers/me`, () =>
    HttpResponse.json({ customer: createMockCustomer() })
  ),

  // Logout handler (DELETE /auth/session)
  http.delete(`${process.env.MEDUSA_API_URL}/auth/session`, () =>
    HttpResponse.json({ success: true })
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

export const invalidRegisterHandler = http.post(
  `${process.env.MEDUSA_API_URL}/auth/customer/emailpass/register`,
  () =>
    HttpResponse.json(
      { message: 'Identity with email already exists' },
      { status: 409 }
    )
);

export const invalidLogoutHandler = http.delete(
  `${process.env.MEDUSA_API_URL}/auth/session`,
  () =>
    HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);
