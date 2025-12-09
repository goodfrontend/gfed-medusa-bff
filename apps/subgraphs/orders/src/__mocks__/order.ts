import { StoreOrder } from '@medusajs/types';

export const createMockOrder = (): StoreOrder =>
  ({
    id: 'order_01JABCDE123456',
    region_id: 'reg_01JREGION123',
    customer_id: 'cust_01JCUST123',
    sales_channel_id: 'sc_01JCHANNEL123',
    email: 'user@example.com',
    currency_code: 'usd',
    payment_status: 'not_paid',
    fulfillment_status: 'not_fulfilled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total: 3000,
    items: [
      {
        id: 'item_1',
        title: 'Mock Product',
        quantity: 2,
        unit_price: 1000,
        variant_id: 'variant_123',
        cart_id: 'cart_123',
        cart: {},
        requires_shipping: false,
        is_discountable: false,
        is_tax_inclusive: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {},
      },
    ],
    shipping_methods: [
      {
        id: 'ship_01JSHIP123',
        order_id: 'order_01JABCDE123456',
        name: 'Standard Shipping',
        amount: 500,
        is_tax_inclusive: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  }) as unknown as StoreOrder;
