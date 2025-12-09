import { StoreCustomer } from '@medusajs/types';

export const mockLoginToken = 'test-auth-token';

export const createMockCustomer = (
  overrides?: Partial<StoreCustomer>
): StoreCustomer => {
  const defaultCustomer: StoreCustomer = {
    id: 'default-customer-id',
    email: 'default@example.com',
    first_name: 'John',
    last_name: 'Doe',
    company_name: 'Default Company',
    phone: '+1234567890',

    addresses: [
      {
        id: 'addr_123',
        address_name: 'Home',
        customer_id: 'default-customer-id',
        company: 'Home Inc',
        first_name: 'John',
        last_name: 'Doe',
        address_1: '123 Main St',
        address_2: 'Apt 4B',
        city: 'New York',
        country_code: 'US',
        province: 'NY',
        postal_code: '10001',
        phone: '+1234567890',
        is_default_billing: true,
        is_default_shipping: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],

    default_billing_address_id: 'addr_123',
    default_shipping_address_id: 'addr_123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    metadata: {},
  };

  return {
    ...defaultCustomer,
    ...overrides,
  };
};
