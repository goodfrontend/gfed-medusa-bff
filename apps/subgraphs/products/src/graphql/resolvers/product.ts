import { GraphQLResolveInfo } from 'graphql';

import {
  QueryBrowseProductsArgs,
  QuerySearchProductsArgs,
} from '@graphql/generated/graphql';
import { HttpTypes } from '@medusajs/types';

import { GraphQLContext } from '../types/context';
import {
  buildNestedProductListFields,
  buildProductCategoriesFields,
  buildProductCategoryFields,
  buildProductQueryFields,
  buildProductsQueryFields,
} from '../utils/fieldProjection';

export const productResolvers = {
  Query: {
    products: async (
      _parent: unknown,
      args: HttpTypes.StoreProductListParams,
      { productService, logger }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildProductsQueryFields(info);
      logger.info({ args }, 'Fetching products');
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        logger.info(
          { projectedFields },
          'Projected Medusa fields for Query.products'
        );
      }
      return await productService.getProducts(args, projectedFields);
    },
    product: async (
      _parent: unknown,
      params: HttpTypes.StoreProductParams & { id: string },
      context: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildProductQueryFields(info);
      context.logger.info({ productId: params.id }, 'Fetching product by ID');
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        context.logger.info(
          { projectedFields },
          'Projected Medusa fields for Query.product'
        );
      }
      return await context.productService.getProduct(
        params.id,
        params,
        projectedFields
      );
    },
    productCategories: async (
      _parent: unknown,
      args: HttpTypes.FindParams & HttpTypes.StoreProductCategoryListParams,
      context: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildProductCategoriesFields(info);
      context.logger.info({ args }, 'Fetching product categories');
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        context.logger.info(
          { projectedFields },
          'Projected Medusa fields for Query.productCategories'
        );
      }
      return await context.categoryService.getCategories(args, projectedFields);
    },
    productCategory: async (
      _parent: unknown,
      params: HttpTypes.StoreProductCategoryParams & { id: string },
      context: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildProductCategoryFields(info);
      context.logger.info(
        { categoryId: params.id },
        'Fetching product category by ID'
      );
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        context.logger.info(
          { projectedFields },
          'Projected Medusa fields for Query.productCategory'
        );
      }
      return await context.categoryService.getCategory(
        params.id,
        projectedFields
      );
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
    browseProducts: async (
      _parent: unknown,
      args: QueryBrowseProductsArgs,
      context: GraphQLContext
    ) => {
      context.logger.info(
        {
          regionId: args.regionId,
          countryCode: args.countryCode,
          sort: args.sort,
          page: args.page,
          hitsPerPage: args.hitsPerPage,
        },
        'Browsing products'
      );
      return await context.algoliaBrowseService.browse(args);
    },
  },
  Product: {
    __resolveReference: async (
      parent: { id: string },
      context: GraphQLContext
    ) => {
      return await context.productService.getProduct(parent.id, {});
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
      context: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildNestedProductListFields(info);

      context.logger.info(
        { collectionId: parent.id, args },
        'Fetching products for collection'
      );
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        context.logger.info(
          { projectedFields },
          'Projected Medusa fields for Collection.products'
        );
      }
      return await context.productService
        .getProducts(
          {
            ...args,
            collection_id: [parent.id],
          },
          projectedFields
        )
        .then(({ products, count }) => ({ items: products, count }));
    },
  },
  ProductCategory: {
    products: async (
      parent: HttpTypes.StoreProductCategory,
      args: HttpTypes.StoreProductListParams,
      context: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const projectedFields = buildNestedProductListFields(info);
      context.logger.info(
        { categoryId: parent.id, args },
        'Fetching products for category'
      );
      if (process.env.LOG_MEDUSA_FIELDS === 'true') {
        context.logger.info(
          { projectedFields },
          'Projected Medusa fields for ProductCategory.products'
        );
      }
      return await context.productService
        .getProducts(
          {
            ...args,
            category_id: [parent.id],
          },
          projectedFields
        )
        .then(({ products, count }) => ({ items: products, count }));
    },
  },
};
