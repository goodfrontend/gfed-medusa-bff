import type { Product } from '@graphql/generated/graphql';
import type { HttpTypes } from '@medusajs/types';

import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { MedusaBaseService } from '..';
import { formatProductData } from './util/formatProductData';

export interface ProductsData {
  count: number;
  products: (Product | null)[];
}

export class ProductService extends MedusaBaseService {
  async getProducts(
    params?: HttpTypes.StoreProductListParams
  ): Promise<ProductsData> {
    try {
      const { products, count } = await this.medusa.store.product.list({
        ...params,
        fields: '+variants.inventory_quantity',
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
    params?: HttpTypes.StoreProductParams
  ): Promise<Product | null> {
    try {
      const { product } = await this.medusa.store.product.retrieve(id, params);
      return formatProductData(product) || null;
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch product', ['product']);
    }
  }

  async getProductsByIds(
    ids: string[],
    params?: HttpTypes.StoreProductListParams
  ): Promise<(Product | null)[]> {
    if (!ids.length) return [];

    try {
      const { products } = await this.medusa.store.product.list({
        ...params,
        id: ids,
        fields: '+variants.inventory_quantity',
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
