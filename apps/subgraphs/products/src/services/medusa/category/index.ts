import { ProductCategory } from '@graphql/generated/graphql';
import type { HttpTypes } from '@medusajs/types';

import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { MedusaBaseService } from '..';
import { CATEGORY_DEFAULT_FIELDS } from '../../../constants/medusa';
import { formatCategoryData } from './util/formatCategoryData';

function mergeMedusaFields(
  existingFields?: string,
  projectedFields?: string
): string {
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

  if (merged.size === 0) return CATEGORY_DEFAULT_FIELDS;

  return Array.from(merged).join(',');
}

export class CategoryService extends MedusaBaseService {
  async getCategories(
    params: HttpTypes.FindParams & HttpTypes.StoreProductCategoryListParams,
    projectedFields?: string
  ): Promise<ProductCategory[]> {
    try {
      const fields = mergeMedusaFields(
        (params as (HttpTypes.FindParams &
          HttpTypes.StoreProductCategoryListParams & {
            fields?: string;
          }) | undefined)?.fields,
        projectedFields
      );
      const { product_categories } = await this.medusa.store.category.list({
        ...params,
        fields,
      });

      return product_categories?.map(formatCategoryData) || [];
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch categories', ['categories']);
    }
  }

  async getCategory(
    id: string,
    projectedFields?: string
  ): Promise<ProductCategory | null> {
    try {
      const fields = mergeMedusaFields(undefined, projectedFields);
      const { product_category } = await this.medusa.store.category.retrieve(
        id,
        {
          fields,
        }
      );

      return product_category ? formatCategoryData(product_category) : null;
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch category', ['category']);
    }
  }
}
