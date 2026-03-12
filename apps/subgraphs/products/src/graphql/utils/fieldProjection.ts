import type { GraphQLResolveInfo } from 'graphql';

import { getSelectedPaths, hasSelectedPath } from './selection';

function buildProductFieldExtrasFromPaths(
  selectedPaths: Set<string>,
  itemPrefix = ''
) {
  const prefix = itemPrefix ? `${itemPrefix}.` : '';
  const extras = new Set<string>();

  if (hasSelectedPath(selectedPaths, `${prefix}variants`)) {
    extras.add('+variants.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}variants.inventoryQuantity`)) {
    extras.add('+variants.inventory_quantity');
  }
  if (
    hasSelectedPath(selectedPaths, `${prefix}variants.price`) ||
    hasSelectedPath(selectedPaths, `${prefix}variants.originalPrice`)
  ) {
    extras.add('+variants.calculated_price');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}variants.options`)) {
    extras.add('+variants.options.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}variants.product`)) {
    extras.add('+variants.product.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}options`)) {
    extras.add('+options.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}images`)) {
    extras.add('+images.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}tags`)) {
    extras.add('+tags.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}collection`)) {
    extras.add('+collection.*');
  }
  if (hasSelectedPath(selectedPaths, `${prefix}type`)) {
    extras.add('+type.*');
  }

  return extras.size > 0 ? Array.from(extras).join(',') : undefined;
}

export function buildProductsQueryFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldExtrasFromPaths(selectedPaths, 'products');
}

export function buildProductQueryFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldExtrasFromPaths(selectedPaths);
}

export function buildNestedProductListFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldExtrasFromPaths(selectedPaths, 'items');
}

