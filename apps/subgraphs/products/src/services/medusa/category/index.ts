import { ProductCategory } from '@graphql/generated/graphql';
import type { HttpTypes } from '@medusajs/types';

import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { MedusaBaseService } from '..';
import { CATEGORY_FIELDS } from '../../../constants/medusa';
import { formatCategoryData } from './util/formatCategoryData';

export class CategoryService extends MedusaBaseService {
  async getCategories(
    params: HttpTypes.FindParams & HttpTypes.StoreProductCategoryListParams
  ): Promise<ProductCategory[]> {
    try {
      const { product_categories } = await this.medusa.store.category.list({
        ...params,
        fields: CATEGORY_FIELDS,
      });

      return product_categories?.map(formatCategoryData) || [];
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch categories', ['categories']);
    }
  }

  async getCategory(id: string): Promise<ProductCategory | null> {
    try {
      const { product_category } = await this.medusa.store.category.retrieve(
        id,
        {
          fields: CATEGORY_FIELDS,
        }
      );

      return product_category ? formatCategoryData(product_category) : null;
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch category', ['category']);
    }
  }
}
