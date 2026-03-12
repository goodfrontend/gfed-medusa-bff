import type { GraphQLResolveInfo } from 'graphql';

import { getSelectedPaths, hasSelectedPath } from './selection';

function toCsv(fields: Set<string>) {
  return Array.from(fields).join(',');
}

export function buildCartFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  const fields = new Set<string>([
    'id',
    'currency_code',
    'item_total',
    'item_subtotal',
    'original_total',
    'total',
    'subtotal',
    'tax_total',
    'discount_total',
    'shipping_total',
    'gift_card_total',
    'email',
    'region_id',
    'customer_id',
    'created_at',
  ]);

  if (hasSelectedPath(selectedPaths, 'items')) {
    fields.add('+items.*');
  }

  if (
    hasSelectedPath(selectedPaths, 'items.variant') ||
    hasSelectedPath(selectedPaths, 'items.productHandle') ||
    hasSelectedPath(selectedPaths, 'items.productTitle')
  ) {
    fields.add('+items.variant.*');
  }

  if (
    hasSelectedPath(selectedPaths, 'items.productHandle') ||
    hasSelectedPath(selectedPaths, 'items.productTitle') ||
    hasSelectedPath(selectedPaths, 'items.variant.product')
  ) {
    fields.add('+items.variant.product.*');
  }

  if (hasSelectedPath(selectedPaths, 'shippingMethods')) {
    fields.add('+shipping_methods.*');
  }

  if (hasSelectedPath(selectedPaths, 'shippingAddress')) {
    fields.add('+shipping_address.*');
  }

  if (hasSelectedPath(selectedPaths, 'billingAddress')) {
    fields.add('+billing_address.*');
  }

  if (hasSelectedPath(selectedPaths, 'promotions')) {
    fields.add('+promotions.*');
  }

  if (hasSelectedPath(selectedPaths, 'region')) {
    fields.add('+region.*');
  }

  if (hasSelectedPath(selectedPaths, 'region.countries')) {
    fields.add('+region.countries.*');
  }

  if (hasSelectedPath(selectedPaths, 'paymentCollection')) {
    fields.add('+payment_collection.*');
  }

  if (hasSelectedPath(selectedPaths, 'paymentCollection.paymentProviders')) {
    fields.add('+payment_collection.payment_providers.*');
  }

  if (hasSelectedPath(selectedPaths, 'paymentCollection.paymentSessions')) {
    fields.add('+payment_collection.payment_sessions.*');
  }

  if (hasSelectedPath(selectedPaths, 'paymentCollection.payments')) {
    fields.add('+payment_collection.payments.*');
  }

  return toCsv(fields);
}

function buildOrderFieldsFromPaths(
  selectedPaths: Set<string>,
  prefix = ''
): string {
  const p = prefix ? `${prefix}.` : '';
  const fields = new Set<string>([
    'id',
    'display_id',
    'email',
    'customer_id',
    'region_id',
    'status',
    'payment_status',
    'fulfillment_status',
    'currency_code',
    'total',
    'subtotal',
    'discount_total',
    'gift_card_total',
    'shipping_total',
    'tax_total',
    'created_at',
  ]);

  if (hasSelectedPath(selectedPaths, `${p}items`)) {
    fields.add('+items.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}items.variant`)) {
    fields.add('+items.variant.*');
  }

  if (
    hasSelectedPath(selectedPaths, `${p}items.productHandle`) ||
    hasSelectedPath(selectedPaths, `${p}items.productTitle`) ||
    hasSelectedPath(selectedPaths, `${p}items.variant.product`)
  ) {
    fields.add('+items.variant.product.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}shippingMethods`)) {
    fields.add('+shipping_methods.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}shippingAddress`)) {
    fields.add('+shipping_address.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}paymentCollections`)) {
    fields.add('+payment_collections.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}paymentCollections.paymentProviders`)) {
    fields.add('+payment_collections.payment_providers.*');
  }

  if (hasSelectedPath(selectedPaths, `${p}paymentCollections.payments`)) {
    fields.add('+payment_collections.payments.*');
  }

  return toCsv(fields);
}

export function buildOrderFields(info: GraphQLResolveInfo) {
  return buildOrderFieldsFromPaths(getSelectedPaths(info));
}

export function buildOrdersListFields(info: GraphQLResolveInfo) {
  return buildOrderFieldsFromPaths(getSelectedPaths(info), 'orders');
}

export function buildRegionFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  const fields = new Set<string>(['id', 'name', 'currency_code', 'created_at']);

  if (hasSelectedPath(selectedPaths, 'countries')) {
    fields.add('+countries.*');
  }

  return toCsv(fields);
}

export function buildRegionsFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  const fields = new Set<string>(['id', 'name', 'currency_code', 'created_at']);

  if (hasSelectedPath(selectedPaths, 'countries')) {
    fields.add('+countries.*');
  }

  return toCsv(fields);
}

export function buildShippingOptionFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  const fields = new Set<string>();

  if (hasSelectedPath(selectedPaths, 'serviceZone')) {
    fields.add('+service_zone.fulfillment_set.type');
    fields.add('+service_zone.fulfillment_set.location.address');
  }
  if (hasSelectedPath(selectedPaths, 'calculatedPrice')) {
    fields.add('+calculated_price');
  }
  if (hasSelectedPath(selectedPaths, 'prices')) {
    fields.add('*prices');
  }
  if (hasSelectedPath(selectedPaths, 'prices.priceRules')) {
    fields.add('*prices.price_rules');
  }

  return fields.size > 0 ? toCsv(fields) : undefined;
}
