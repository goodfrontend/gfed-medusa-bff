import type { GraphQLResolveInfo } from 'graphql';

import { getSelectedPaths, hasSelectedPath } from './selection';

function buildProductScalarFieldsFromPaths(
  selectedPaths: Set<string>,
  itemPrefix = ''
) {
  const prefix = itemPrefix ? `${itemPrefix}.` : '';
  const scalars = new Set<string>();

  if (hasSelectedPath(selectedPaths, `${prefix}id`)) scalars.add('id');
  if (hasSelectedPath(selectedPaths, `${prefix}title`)) scalars.add('title');
  if (hasSelectedPath(selectedPaths, `${prefix}handle`)) scalars.add('handle');
  if (hasSelectedPath(selectedPaths, `${prefix}description`))
    scalars.add('description');
  if (hasSelectedPath(selectedPaths, `${prefix}thumbnail`))
    scalars.add('thumbnail');
  if (hasSelectedPath(selectedPaths, `${prefix}width`)) scalars.add('width');
  if (hasSelectedPath(selectedPaths, `${prefix}weight`)) scalars.add('weight');
  if (hasSelectedPath(selectedPaths, `${prefix}length`)) scalars.add('length');
  if (hasSelectedPath(selectedPaths, `${prefix}height`)) scalars.add('height');
  if (hasSelectedPath(selectedPaths, `${prefix}originCountry`))
    scalars.add('origin_country');
  if (hasSelectedPath(selectedPaths, `${prefix}material`))
    scalars.add('material');
  if (hasSelectedPath(selectedPaths, `${prefix}collectionId`))
    scalars.add('collection_id');
  if (hasSelectedPath(selectedPaths, `${prefix}createdAt`))
    scalars.add('created_at');

  return scalars;
}

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
  if (hasSelectedPath(selectedPaths, `${prefix}options.values`)) {
    extras.add('+options.values.*');
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

  return extras;
}

function buildProductFieldsFromPaths(
  selectedPaths: Set<string>,
  itemPrefix = ''
) {
  const scalars = buildProductScalarFieldsFromPaths(selectedPaths, itemPrefix);
  const extras = buildProductFieldExtrasFromPaths(selectedPaths, itemPrefix);
  const fields = new Set<string>([...scalars, ...extras]);

  return fields.size > 0 ? Array.from(fields).join(',') : undefined;
}

export function buildProductsQueryFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldsFromPaths(selectedPaths, 'products');
}

export function buildProductQueryFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldsFromPaths(selectedPaths);
}

export function buildNestedProductListFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildProductFieldsFromPaths(selectedPaths, 'items');
}

function buildCategoryFieldsFromPaths(
  selectedPaths: Set<string>,
  itemPrefix = ''
) {
  const prefix = itemPrefix ? `${itemPrefix}.` : '';
  const fields = new Set<string>(['id']);

  if (hasSelectedPath(selectedPaths, `${prefix}name`)) fields.add('name');
  if (hasSelectedPath(selectedPaths, `${prefix}description`))
    fields.add('description');
  if (hasSelectedPath(selectedPaths, `${prefix}handle`)) fields.add('handle');

  if (hasSelectedPath(selectedPaths, `${prefix}parentCategory`)) {
    fields.add('parent_category.id');
    fields.add('parent_category.name');
    fields.add('parent_category.description');
    fields.add('parent_category.handle');
  }

  if (hasSelectedPath(selectedPaths, `${prefix}categoryChildren`)) {
    fields.add('category_children.id');
    fields.add('category_children.name');
    fields.add('category_children.description');
    fields.add('category_children.handle');
  }

  return Array.from(fields).join(',');
}

export function buildProductCategoriesFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildCategoryFieldsFromPaths(selectedPaths);
}

export function buildProductCategoryFields(info: GraphQLResolveInfo) {
  const selectedPaths = getSelectedPaths(info);
  return buildCategoryFieldsFromPaths(selectedPaths);
}
