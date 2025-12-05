import {
  CompleteCartErrorResult,
  CompleteCartOrderResult,
  CompleteCartResponse,
} from '@graphql/generated/graphql';
import {
  StoreCart,
  StoreCompleteCartResponse,
  StoreOrder,
  StorePaymentCollection,
} from '@medusajs/types';

const normalizeInt = (v: number | null | undefined): number => v ?? 0;

function isOrderResponse(
  response: CompleteCartResponse
): response is CompleteCartOrderResult {
  return response.type === 'order';
}

function isCartResponse(
  response: CompleteCartResponse
): response is CompleteCartErrorResult {
  return response.type === 'cart';
}

export function normalizeCompleteCartResponse(
  response: StoreCompleteCartResponse
): any {
  if (isOrderResponse(response)) {
    const order: StoreOrder = response.order as StoreOrder;

    return {
      type: 'order',
      order: {
        id: order?.id,
        regionId: order?.region_id ?? '',
        customerId: order?.customer_id ?? '',
        email: order?.email ?? '',
        paymentStatus: order?.payment_status ?? '',
        fulfillmentStatus: order?.fulfillment_status ?? '',
        total: order?.total ?? 0,
        status: order?.status ?? '',
        createdAt: order?.created_at ?? null,
        currencyCode: order?.currency_code ?? '',
        items: normalizeLineItems(order?.items ?? []),
        shippingMethods:
          order?.shipping_methods?.map((method) => ({
            id: method.id,
            name: method.name,
            amount: method.amount,
            shippingOptionId: method.shipping_option_id,
          })) ?? [],

        shippingAddress: normalizeAddress(order?.shipping_address),
      },
    };
  }

  if (isCartResponse(response)) {
    if (!response.cart) {
      throw new Error(
        'Expected cart to be defined for CompleteCartResponse of type "cart"'
      );
    }

    return {
      type: 'cart',
      cart: response.cart,
      error: {
        message: response.error?.message ?? '',
        name: response.error?.name ?? '',
        type: response.error?.type ?? '',
      },
    };
  }

  throw new Error('Unexpected CompleteCartResponse type');
}

export function normalizePaymentCollection(
  collection: StorePaymentCollection | null | undefined
): any | undefined {
  if (!collection) return;

  return {
    id: collection.id ?? '',
    amount: normalizeInt(collection.amount),
    currencyCode: collection.currency_code ?? '',
    paymentProviders: collection.payment_providers ?? [],
    paymentSessions:
      collection.payment_sessions?.map((s) => ({
        id: s.id ?? '',
        amount: s.amount ?? 0,
        currencyCode: s.currency_code ?? 'eur',
        providerId: s.provider_id ?? '',
        status: s.status ?? '',
        data: s.data ?? {},
      })) ?? [],
    createdAt: collection.created_at,
    status: collection.status ?? 'not_paid',
  };
}

export function normalizeLineItems(items: any[] = [], cartId?: string) {
  return items.map((item) => ({
    id: item.id,
    title: item.title ?? '',
    quantity: item.quantity ?? 0,
    requiresShipping: item.requires_shipping ?? false,
    unitPrice: item.unit_price ?? 0,
    total: item.total ?? 0,
    originalTotal: item.original_total ?? 0,
    cartId: item.cart_id ?? cartId ?? '',
    thumbnail: item.thumbnail ?? '',
    productHandle: item.variant?.product?.handle ?? '',
    productTitle: item.variant?.product?.title ?? '',
    createdAt: item.created_at ?? null,
    variant: item.variant ?? null,
  }));
}

function normalizeAddress(address: any) {
  if (!address) return null;
  return {
    id: address.id,
    metadata: address.metadata ?? {},
    createdAt: address.created_at,
    firstName: address.first_name,
    lastName: address.last_name,
    phone: address.phone,
    address1: address.address_1,
    address2: address.address_2,
    company: address.company,
    province: address.province,
    city: address.city,
    countryCode: address.country_code,
    postalCode: address.postal_code,
  };
}

export function normalizeCart(cart: StoreCart): any {
  return {
    id: cart.id,
    currencyCode: cart.currency_code ?? '',
    itemTotal: normalizeInt(cart.item_total),
    itemSubtotal: normalizeInt(cart.item_subtotal),
    originalTotal: normalizeInt(cart.original_total),
    total: normalizeInt(cart.total),
    subtotal: normalizeInt(cart.subtotal),
    taxTotal: normalizeInt(cart.tax_total),
    discountTotal: normalizeInt(cart.discount_total),
    shippingTotal: normalizeInt(cart.shipping_total),
    giftCardTotal: normalizeInt(cart.gift_card_total),
    promotions: cart.promotions ?? [],
    email: cart.email ?? '',
    items: normalizeLineItems(cart.items, cart.id),
    regionId: cart.region_id ?? '',
    shippingAddress: normalizeAddress(cart.shipping_address),
    billingAddress: normalizeAddress(cart.billing_address),
    createdAt: cart.created_at,
    shippingMethods: (cart.shipping_methods ?? []).map((sm) => ({
      id: sm.id ?? '',
      cartId: sm.cart_id ?? cart.id ?? '',
      name: sm.name ?? '',
      amount: sm.amount ?? 0,
      createdAt: sm.created_at,
      shippingOptionId: sm.shipping_option_id,
    })),
    region: cart.region
      ? {
          id: cart.region.id ?? '',
          name: cart.region.name ?? '',
          currencyCode: cart.region.currency_code ?? '',
          countries: (cart.region.countries ?? []).map((c) => ({
            id: c.id,
            iso2: c.iso_2,
            iso3: c.iso_3,
            name: c.name,
            displayName: c.display_name,
          })),
          createdAt: cart.region.created_at,
        }
      : null,
    paymentCollection: normalizePaymentCollection(cart.payment_collection),
    customerId: cart.customer_id ?? '',
  };
}

export function camelToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(camelToSnakeCase);
  } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const snakeKey = key
          .replace(/([A-Z])/g, '_$1') // handle camelCase letters
          .replace(/([a-z])([0-9])/g, '$1_$2') // handle letters followed by numbers
          .toLowerCase();
        acc[snakeKey] = camelToSnakeCase(value);
        return acc;
      },
      {} as Record<string, any>
    );
  }
  return obj;
}
