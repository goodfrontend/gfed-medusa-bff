import { HttpTypes } from '@medusajs/types';

export const createMockShippingOption = (): HttpTypes.StoreCartShippingOption =>
  ({
    id: 'so_123',
    name: 'Standard Shipping',
    price_type: 'flat_rate',
    amount: 500,
    service_zone_id: 'sz_123',
    insufficient_inventory: false,
    service_zone: {
      fulfillment_set: {
        type: 'shipping',
        location: {
          address: {
            city: 'New York',
            country_code: 'us',
            address_1: '123 Main St',
            postal_code: '10001',
          },
        },
      },
    },
  } as any);

export const createMockCalculatedShippingOption = (): HttpTypes.StoreCartShippingOption =>
  ({
    id: 'so_456',
    name: 'Express Shipping',
    price_type: 'calculated',
    amount: 1200,
    service_zone_id: 'sz_123',
    insufficient_inventory: false,
    service_zone: null,
  } as any);
