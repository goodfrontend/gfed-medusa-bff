import type express from 'express';

import type { Logger } from '@gfed-medusa/bff-lib-common';
import Medusa from '@medusajs/js-sdk';
import { AlgoliaSearchService } from '@services/algolia/search';
import { CategoryService } from '@services/medusa/category';
import { CollectionService } from '@services/medusa/collection';
import { ProductService } from '@services/medusa/product';

export type GraphQLContext = {
  req: express.Request;
  res: express.Response;
  medusa: Medusa;
  logger: Logger;
  productService: ProductService;
  categoryService: CategoryService;
  collectionService: CollectionService;
  algoliaSearchService: AlgoliaSearchService;
};
