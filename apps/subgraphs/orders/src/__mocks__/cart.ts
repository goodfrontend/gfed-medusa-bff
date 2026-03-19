import { StoreCart } from '@medusajs/types';

export const createMockCart = (): StoreCart => {
  const defaultCart = {
    id: 'cart_123',
    regionId: 'reg_123',
    customerId: 'cust_123',
    email: 'customer@example.com',
    currencyCode: 'usd',
    shippingAddress: undefined,
    billingAddress: undefined,
    itemTotal: 2000,
    subtotal: 2000,
    shippingTotal: 0,
    shippingSubtotal: 0,
    taxTotal: 0,
    total: 2000,
    discountTotal: 0,
    giftCardTotal: 0,
    originalTotal: 2000,

    promotions: [],
    region: {
      id: 'reg_123',
      name: 'US Region',
      currencyCode: 'usd',
      createdAt: new Date().toISOString(),
      countries: [],
    },

    items: [
      {
        id: 'item_1',
        title: 'Mock Product',
        quantity: 2,
        unitPrice: 1000,
        variantId: 'variant_123',
        cartId: 'cart_123',
        cart: {} as StoreCart,
        requiresShipping: true,
        createdAt: new Date().toISOString(),
        metadata: {},
        variant: {
          id: 'variant_123',
          title: 'Small',
          sku: 'MOCK-S',
          inventory_quantity: 10,
          allow_backorder: false,
          manage_inventory: true,
          product_id: 'prod_123',
          options: [
            {
              id: 'opt_val_1',
              option_id: 'opt_1',
              value: 'Small',
            },
          ],
          calculated_price: {
            currency_code: 'usd',
            calculated_amount: 1000,
            original_amount: 1200,
            calculated_price: {
              price_list_type: 'default',
            },
            original_price: {
              price_list_type: 'default',
            },
          },
          product: {
            id: 'prod_123',
            title: 'Mock Product',
            handle: 'mock-product',
            thumbnail: 'https://example.com/mock-product.jpg',
          },
        },
      },
    ],

    shippingMethods: [],
    createdAt: new Date().toISOString(),
    metadata: {},
  };

  return defaultCart as unknown as StoreCart;
};
