import { QuerySearchProductsArgs } from '@graphql/generated/graphql';
import { HttpTypes } from '@medusajs/types';

import { GraphQLContext } from '../types/context';

export const productResolvers = {
  Query: {
    products: async (
      _parent: unknown,
      args: HttpTypes.StoreProductParams & { id?: string },
      { productService, logger }: GraphQLContext
    ) => {
      logger.info({ args }, 'Fetching products');
      return await productService.getProducts(args);
    },
    product: async (
      _parent: unknown,
      params: HttpTypes.StoreProductParams & { id: string },
      context: GraphQLContext
    ) => {
      context.logger.info({ productId: params.id }, 'Fetching product by ID');
      return await context.productService.getProduct(params.id, params);
    },
    productCategories: async (
      _parent: unknown,
      args: HttpTypes.FindParams & HttpTypes.StoreProductCategoryListParams,
      context: GraphQLContext
    ) => {
      context.logger.info({ args }, 'Fetching product categories');
      return await context.categoryService.getCategories(args);
    },
    productCategory: async (
      _parent: unknown,
      params: HttpTypes.StoreProductCategoryParams & { id: string },
      context: GraphQLContext
    ) => {
      context.logger.info(
        { categoryId: params.id },
        'Fetching product category by ID'
      );
      return await context.categoryService.getCategory(params.id);
    },
    collections: async (
      _parent: unknown,
      args: HttpTypes.FindParams & HttpTypes.StoreCollectionFilters,
      context: GraphQLContext
    ) => {
      context.logger.info({ args }, 'Fetching collections');
      return await context.collectionService.getCollections(args);
    },
    collection: async (
      _parent: unknown,
      params: { id: string },
      context: GraphQLContext
    ) => {
      context.logger.info(
        { collectionId: params.id },
        'Fetching collection by ID'
      );
      return await context.collectionService.getCollection(params.id);
    },
    searchProducts: async (
      _parent: unknown,
      args: QuerySearchProductsArgs,
      context: GraphQLContext
    ) => {
      context.logger.info({ query: args.query }, 'Searching products');
      return await context.algoliaSearchService.search(args);
    },
  },
  ProductVariant: {
    product: async (
      parent: { productId?: string; product?: unknown },
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (parent.product) return parent.product as any;
      if (!parent.productId) return null;
      return await context.productByIdLoader.load(parent.productId);
    },
  },
  Collection: {
    products: async (
      parent: HttpTypes.StoreCollection,
      args: HttpTypes.StoreProductListParams,
      context: GraphQLContext
    ) => {
      context.logger.info(
        { collectionId: parent.id, args },
        'Fetching products for collection'
      );
      return await context.productService
        .getProducts({
          ...args,
          collection_id: [parent.id],
        })
        .then(({ products, count }) => ({ items: products, count }));
    },
  },
  ProductCategory: {
    products: async (
      parent: HttpTypes.StoreProductCategory,
      args: HttpTypes.StoreProductListParams,
      context: GraphQLContext
    ) => {
      context.logger.info(
        { categoryId: parent.id, args },
        'Fetching products for category'
      );
      return await context.productService
        .getProducts({
          ...args,
          category_id: [parent.id],
        })
        .then(({ products, count }) => ({ items: products, count }));
    },
  },
};
