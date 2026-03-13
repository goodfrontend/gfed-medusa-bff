import type { Product } from '@graphql/generated/graphql';
import type { HttpTypes } from '@medusajs/types';

import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { MedusaBaseService } from '..';
import { formatProductData } from './util/formatProductData';

export interface ProductsData {
  count: number;
  products: (Product | null)[];
}

function mergeMedusaFields(
  existingFields?: string,
  projectedFields?: string
): string | undefined {
  const merged = new Set<string>();

  if (existingFields) {
    existingFields
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
      .forEach((field) => merged.add(field));
  }

  if (projectedFields) {
    projectedFields
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
      .forEach((field) => merged.add(field));
  }

  return merged.size > 0 ? Array.from(merged).join(',') : undefined;
}

function hasPricingContext(params?: {
  region_id?: string;
  regionId?: string;
}) {
  return Boolean(params?.region_id || params?.regionId);
}

function sanitizeProductFieldsForContext(
  fields: string | undefined,
  params?: HttpTypes.StoreProductListParams | HttpTypes.StoreProductParams
) {
  if (!fields) return fields;
  if (hasPricingContext(params)) return fields;

  // Medusa requires region_id when calculated prices are requested.
  return fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field && field !== '+variants.calculated_price')
    .join(',');
}

export class ProductService extends MedusaBaseService {
  async getProducts(
    params?: HttpTypes.StoreProductListParams,
    projectedFields?: string
  ): Promise<ProductsData> {
    try {
      const fields = mergeMedusaFields(
        (params as (HttpTypes.StoreProductListParams & { fields?: string }) | undefined)
          ?.fields,
        projectedFields
      );

      const { products, count } = await this.medusa.store.product.list({
        ...params,
        ...(fields
          ? { fields: sanitizeProductFieldsForContext(fields, params) }
          : {}),
      });

      return {
        count,
        products: products.map((product) => formatProductData(product)),
      };
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch products', ['products']);
    }
  }

  async getProduct(
    id: string,
    params?: HttpTypes.StoreProductParams,
    projectedFields?: string
  ): Promise<Product | null> {
    try {
      const fields = mergeMedusaFields(
        (params as (HttpTypes.StoreProductParams & { fields?: string }) | undefined)
          ?.fields,
        projectedFields
      );

      const { product } = await this.medusa.store.product.retrieve(id, {
        ...params,
        ...(fields
          ? { fields: sanitizeProductFieldsForContext(fields, params) }
          : {}),
      });
      return formatProductData(product) || null;
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch product', ['product']);
    }
  }

  async getProductsByIds(
    ids: string[],
    params?: HttpTypes.StoreProductListParams,
    projectedFields?: string
  ): Promise<(Product | null)[]> {
    if (!ids.length) return [];

    try {
      const fields = mergeMedusaFields(
        (params as (HttpTypes.StoreProductListParams & { fields?: string }) | undefined)
          ?.fields,
        projectedFields
      );

      const { products } = await this.medusa.store.product.list({
        ...params,
        id: ids,
        ...(fields
          ? { fields: sanitizeProductFieldsForContext(fields, params) }
          : {}),
      });

      const mapped = new Map(
        products.map((product) => [product.id, formatProductData(product)])
      );

      return ids.map((id) => mapped.get(id) ?? null);
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch products by ids', ['products']);
    }
  }
}
