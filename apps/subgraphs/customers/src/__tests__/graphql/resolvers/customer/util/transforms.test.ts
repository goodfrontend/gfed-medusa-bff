import { transformCustomer } from '@graphql/resolvers/util/transforms';
import { BaseCustomerAddress } from '@medusajs/types/dist/http/customer/common';
import { createMockCustomer } from '@mocks/customer';

describe('customerResolver utility functions', () => {
  it('transforms customer data into expected structure', () => {
    const mockCustomer = createMockCustomer({
      id: 'cus_123',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      default_billing_address_id: 'addr_123',
      default_shipping_address_id: 'addr_123',
      company_name: 'Acme Inc',
      phone: '+1000000000',
      addresses: [
        {
          id: 'addr_123',
          address_name: 'Home',
          customer_id: 'cus_123',
          company: 'Acme Inc',
          first_name: 'John',
          last_name: 'Doe',
          address_1: '123 Main St',
          address_2: 'Suite 1',
          city: 'Metropolis',
          country_code: 'US',
          province: 'NY',
          postal_code: '10001',
          phone: '+1000000000',
          is_default_billing: true,
          is_default_shipping: false,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const before = JSON.parse(JSON.stringify(mockCustomer));

    const result = transformCustomer(mockCustomer as any);

    // top-level fields
    expect(result.id).toBe('cus_123');
    expect(result.email).toBe('john@example.com');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.companyName).toBe('Acme Inc');
    expect(result.phone).toBe('+1000000000');
    expect(result.defaultBillingAddressId).toBe('addr_123');
    expect(result.defaultShippingAddressId).toBe('addr_123');

    // addresses mapping
    expect(Array.isArray(result.addresses)).toBe(true);
    expect(result.addresses).toHaveLength(1);
    const addr = result.addresses![0]!;
    expect(addr.id).toBe('addr_123');
    expect(addr.addressName).toBe('Home');
    expect(addr.isDefaultBilling).toBe(true);
    expect(addr.isDefaultShipping).toBe(false);
    expect(addr.customerId).toBe('cus_123');
    expect(addr.company).toBe('Acme Inc');
    expect(addr.firstName).toBe('John');
    expect(addr.lastName).toBe('Doe');
    expect(addr.address1).toBe('123 Main St');
    expect(addr.address2).toBe('Suite 1');
    expect(addr.city).toBe('Metropolis');
    expect(addr.countryCode).toBe('US');
    expect(addr.province).toBe('NY');
    expect(addr.postalCode).toBe('10001');
    expect(addr.phone).toBe('+1000000000');

    // ensure input was not mutated
    expect(mockCustomer).toEqual(before);
  });

  it('handles empty addresses array', () => {
    const mockCustomer = createMockCustomer({
      id: 'cus_empty',
      email: 'empty@example.com',
      addresses: [],
    });

    const result = transformCustomer(mockCustomer as any);
    expect(result.addresses).toEqual([]);
    expect(result.id).toBe('cus_empty');
    expect(result.email).toBe('empty@example.com');
  });

  it('properly maps partial address fields', () => {
    const partialAddress: BaseCustomerAddress = {
      id: 'addr_partial',
      address_name: undefined as any,
      customer_id: 'cus_part',
      company: undefined as any,
      first_name: 'Alice',
      last_name: undefined as any,
      address_1: '1 Road',
      address_2: undefined as any,
      city: 'City',
      country_code: 'US',
      province: undefined as any,
      postal_code: '00000',
      phone: undefined as any,
      is_default_billing: false,
      is_default_shipping: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockCustomer = createMockCustomer({
      id: 'cus_part',
      email: 'part@example.com',
      addresses: [partialAddress as any],
    });

    const result = transformCustomer(mockCustomer as any);
    expect(result.addresses).toHaveLength(1);
    const addr = result.addresses![0]!;
    expect(addr.id).toBe('addr_partial');
    expect(addr.firstName).toBe('Alice');
    expect(addr.address1).toBe('1 Road');
  });
});
