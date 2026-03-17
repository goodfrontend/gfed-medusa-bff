import { __testUtils } from '@graphql/utils/fieldProjection';

describe('fieldProjection', () => {
  it('does not request unsupported default address id fields', () => {
    const fields = __testUtils.buildCustomerFieldsFromPaths(new Set());

    expect(fields).toContain('id');
    expect(fields).toContain('email');
    expect(fields).not.toContain('default_billing_address_id');
    expect(fields).not.toContain('default_shipping_address_id');
  });

  it('includes addresses when they are selected', () => {
    const fields = __testUtils.buildCustomerFieldsFromPaths(
      new Set(['addresses', 'addresses.id'])
    );

    expect(fields).toContain('+addresses.*');
  });
});
