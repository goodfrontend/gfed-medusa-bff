import { QuerySearchProductsArgs } from '@graphql/generated/graphql';
import { HttpTypes } from '@medusajs/types';

import { GraphQLContext } from '../types/context';

export const productResolvers = {
  Query: {
    products: async (
      _parent: unknown,
      args: HttpTypes.StoreProductParams & { id?: string },
      { productService }: GraphQLContext
    ) => {
      return await productService.getProducts(args);
    },
    product: async (
      _parent: unknown,
      params: HttpTypes.StoreProductParams & { id: string },
      context: GraphQLContext
    ) => {
      return await context.productService.getProduct(params.id, params);
    },
    productCategories: async (
      _parent: unknown,
      args: HttpTypes.FindParams & HttpTypes.StoreProductCategoryListParams,
      context: GraphQLContext
    ) => {
      return await context.categoryService.getCategories(args);
    },
    productCategory: async (
      _parent: unknown,
      params: HttpTypes.StoreProductCategoryParams & { id: string },
      context: GraphQLContext
    ) => {
      return await context.categoryService.getCategory(params.id);
    },
    collections: async (
      _parent: unknown,
      args: HttpTypes.FindParams & HttpTypes.StoreCollectionFilters,
      context: GraphQLContext
    ) => {
      return await context.collectionService.getCollections(args);
    },
    collection: async (
      _parent: unknown,
      params: { id: string },
      context: GraphQLContext
    ) => {
      return await context.collectionService.getCollection(params.id);
    },
    searchProducts: async (
      _parent: unknown,
      args: QuerySearchProductsArgs,
      context: GraphQLContext
    ) => {
      return await context.algoliaSearchService.search(args);
    },
  },
  Collection: {
    products: async (
      parent: HttpTypes.StoreCollection,
      args: HttpTypes.StoreProductListParams,
      context: GraphQLContext
    ) => {
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
      return await context.productService
        .getProducts({
          ...args,
          category_id: [parent.id],
        })
        .then(({ products, count }) => ({ items: products, count }));
    },
  },
};
