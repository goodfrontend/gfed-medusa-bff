import type express from 'express';

import type { Logger } from '@gfed-medusa/bff-lib-common';
import Medusa from '@medusajs/js-sdk';
import { AlgoliaSearchService } from '@services/algolia/search';
import { CategoryService } from '@services/medusa/category';
import { CollectionService } from '@services/medusa/collection';
import { ProductService } from '@services/medusa/product';
import DataLoader from 'dataloader';
import type { Product } from '@graphql/generated/graphql';

export type GraphQLContext = {
  req: express.Request;
  res: express.Response;
  medusa: Medusa;
  logger: Logger;
  productService: ProductService;
  productByIdLoader: DataLoader<string, Product | null>;
  categoryService: CategoryService;
  collectionService: CollectionService;
  algoliaSearchService: AlgoliaSearchService;
};
