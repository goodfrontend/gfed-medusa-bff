import type express from 'express';

import type { Logger } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import type { Product } from '@graphql/generated/graphql';
import Medusa from '@medusajs/js-sdk';
import DataLoader from 'dataloader';

import { AlgoliaSearchService } from './algolia/search';
import { CategoryService } from './medusa/category';
import { CollectionService } from './medusa/collection';
import { ProductService } from './medusa/product';

export function createContext({
  req,
  res,
  logger,
}: {
  req: express.Request;
  res: express.Response;
  logger: Logger;
}): GraphQLContext {
  let _productService: ProductService | null = null;
  let _categoryService: CategoryService | null = null;
  let _collectionService: CollectionService | null = null;
  let _algoliaSearchService: AlgoliaSearchService | null = null;
  let _productByIdLoader: DataLoader<string, Product | null> | null = null;

  const createMedusa = () => {
    const medusa = new Medusa({
      baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
      globalHeaders: {
        'X-Publishable-API-Key':
          process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_test',
      },
    });

    return medusa;
  };

  const medusa = createMedusa();

  const algoliaService = new AlgoliaSearchService(
    process.env.ALGOLIA_APP_ID,
    process.env.ALGOLIA_API_KEY,
    process.env.ALGOLIA_PRODUCT_INDEX_NAME
  );

  const getProductService = () => {
    if (!_productService) _productService = new ProductService(medusa);
    return _productService;
  };

  return {
    req,
    res,
    medusa,
    logger,
    get productService() {
      return getProductService();
    },
    get productByIdLoader() {
      if (!_productByIdLoader) {
        _productByIdLoader = new DataLoader(async (ids: readonly string[]) => {
          return await getProductService().getProductsByIds(ids as string[], {});
        });
      }
      return _productByIdLoader;
    },
    get categoryService() {
      if (!_categoryService) _categoryService = new CategoryService(medusa);
      return _categoryService;
    },
    get collectionService() {
      if (!_collectionService)
        _collectionService = new CollectionService(medusa);
      return _collectionService;
    },
    get algoliaSearchService() {
      if (!_algoliaSearchService) _algoliaSearchService = algoliaService;
      return _algoliaSearchService;
    },
  };
}
