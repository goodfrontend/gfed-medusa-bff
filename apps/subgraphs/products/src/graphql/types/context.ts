import type express from 'express';

import Medusa from '@medusajs/js-sdk';
import { AlgoliaSearchService } from '@services/algolia/search';
import { CategoryService } from '@services/medusa/category';
import { CollectionService } from '@services/medusa/collection';
import { ProductService } from '@services/medusa/product';

export type GraphQLContext = {
  req: express.Request;
  res: express.Response;
  medusa: Medusa;
  productService: ProductService;
  categoryService: CategoryService;
  collectionService: CollectionService;
  algoliaSearchService: AlgoliaSearchService;
};
