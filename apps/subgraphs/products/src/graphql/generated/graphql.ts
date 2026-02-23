import type {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';

import type { GraphQLContext } from '../types/context';

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: string; output: string };
};

export type CacheControlScope = 'PRIVATE' | 'PUBLIC';

export type Collection = {
  handle: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  products?: Maybe<ProductList>;
  title: Scalars['String']['output'];
};

export type Price = {
  amount?: Maybe<Scalars['Float']['output']>;
  currencyCode?: Maybe<Scalars['String']['output']>;
  priceType?: Maybe<Scalars['String']['output']>;
};

export type Product = {
  collection?: Maybe<Collection>;
  collectionId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  handle: Scalars['String']['output'];
  height?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  images?: Maybe<Array<ProductImage>>;
  length?: Maybe<Scalars['Float']['output']>;
  material?: Maybe<Scalars['String']['output']>;
  options?: Maybe<Array<ProductOption>>;
  originCountry?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<ProductTag>>;
  thumbnail?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  type?: Maybe<Scalars['String']['output']>;
  variants?: Maybe<Array<ProductVariant>>;
  weight?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

export type ProductCategory = {
  categoryChildren?: Maybe<Array<ProductCategory>>;
  description?: Maybe<Scalars['String']['output']>;
  handle: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parentCategory?: Maybe<ProductCategory>;
  products?: Maybe<ProductList>;
};

export type ProductHit = {
  description?: Maybe<Scalars['String']['output']>;
  handle: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  thumbnail?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ProductImage = {
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
};

export type ProductList = {
  count: Scalars['Int']['output'];
  items?: Maybe<Array<Product>>;
};

export type ProductListResponse = {
  count: Scalars['Int']['output'];
  products?: Maybe<Array<Maybe<Product>>>;
};

export type ProductOption = {
  id: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  values: Array<ProductOptionValue>;
};

export type ProductOptionValue = {
  id: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type ProductTag = {
  id: Scalars['ID']['output'];
};

export type ProductVariant = {
  allowBackorder?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  inventoryQuantity?: Maybe<Scalars['Int']['output']>;
  manageInventory?: Maybe<Scalars['Boolean']['output']>;
  options?: Maybe<Array<Maybe<ProductVariantOption>>>;
  originalPrice?: Maybe<Price>;
  price?: Maybe<Price>;
  product?: Maybe<Product>;
  sku?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ProductVariantOption = {
  id: Scalars['ID']['output'];
  optionId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type Query = {
  collection?: Maybe<Collection>;
  collections: Array<Collection>;
  product?: Maybe<Product>;
  productCategories: Array<ProductCategory>;
  productCategory?: Maybe<ProductCategory>;
  products: ProductListResponse;
  searchProducts: SearchProducts;
};

export type QueryCollectionArgs = {
  id: Scalars['ID']['input'];
};

export type QueryCollectionsArgs = {
  handle?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryProductArgs = {
  id: Scalars['ID']['input'];
  region_id?: InputMaybe<Scalars['String']['input']>;
};

export type QueryProductCategoriesArgs = {
  handle?: InputMaybe<Scalars['String']['input']>;
  include_descendants_tree?: InputMaybe<Scalars['Boolean']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  is_internal?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  parent_category_id?: InputMaybe<Scalars['String']['input']>;
  q?: InputMaybe<Scalars['String']['input']>;
};

export type QueryProductCategoryArgs = {
  id: Scalars['ID']['input'];
};

export type QueryProductsArgs = {
  category_id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collection_id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  handle?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Array<Scalars['ID']['input']>>;
  is_giftcard?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  q?: InputMaybe<Scalars['String']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  tag_id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type QuerySearchProductsArgs = {
  facets?: InputMaybe<Array<Scalars['String']['input']>>;
  filters?: InputMaybe<Scalars['String']['input']>;
  hitsPerPage?: InputMaybe<Scalars['Int']['input']>;
  indexName?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
};

export type SearchProducts = {
  hitsPerPage: Scalars['Int']['output'];
  items: Array<ProductHit>;
  page: Scalars['Int']['output'];
  params: Scalars['String']['output'];
  query: Scalars['String']['output'];
  total: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<
  TTypes,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<
  T = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CacheControlScope: CacheControlScope;
  Collection: ResolverTypeWrapper<Collection>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Price: ResolverTypeWrapper<Price>;
  Product: ResolverTypeWrapper<Product>;
  ProductCategory: ResolverTypeWrapper<ProductCategory>;
  ProductHit: ResolverTypeWrapper<ProductHit>;
  ProductImage: ResolverTypeWrapper<ProductImage>;
  ProductList: ResolverTypeWrapper<ProductList>;
  ProductListResponse: ResolverTypeWrapper<ProductListResponse>;
  ProductOption: ResolverTypeWrapper<ProductOption>;
  ProductOptionValue: ResolverTypeWrapper<ProductOptionValue>;
  ProductTag: ResolverTypeWrapper<ProductTag>;
  ProductVariant: ResolverTypeWrapper<ProductVariant>;
  ProductVariantOption: ResolverTypeWrapper<ProductVariantOption>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SearchProducts: ResolverTypeWrapper<SearchProducts>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean']['output'];
  Collection: Collection;
  DateTime: Scalars['DateTime']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Price: Price;
  Product: Product;
  ProductCategory: ProductCategory;
  ProductHit: ProductHit;
  ProductImage: ProductImage;
  ProductList: ProductList;
  ProductListResponse: ProductListResponse;
  ProductOption: ProductOption;
  ProductOptionValue: ProductOptionValue;
  ProductTag: ProductTag;
  ProductVariant: ProductVariant;
  ProductVariantOption: ProductVariantOption;
  Query: Record<PropertyKey, never>;
  SearchProducts: SearchProducts;
  String: Scalars['String']['output'];
};

export type CacheControlDirectiveArgs = {
  maxAge?: Maybe<Scalars['Int']['input']>;
  scope?: Maybe<CacheControlScope>;
};

export type CacheControlDirectiveResolver<
  Result,
  Parent,
  ContextType = GraphQLContext,
  Args = CacheControlDirectiveArgs,
> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type CollectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Collection'] =
    ResolversParentTypes['Collection'],
> = {
  handle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  products?: Resolver<
    Maybe<ResolversTypes['ProductList']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['DateTime'],
  any
> {
  name: 'DateTime';
}

export type PriceResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Price'] =
    ResolversParentTypes['Price'],
> = {
  amount?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  currencyCode?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  priceType?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
};

export type ProductResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Product'] =
    ResolversParentTypes['Product'],
> = {
  collection?: Resolver<
    Maybe<ResolversTypes['Collection']>,
    ParentType,
    ContextType
  >;
  collectionId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  handle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  height?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  images?: Resolver<
    Maybe<Array<ResolversTypes['ProductImage']>>,
    ParentType,
    ContextType
  >;
  length?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  material?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<
    Maybe<Array<ResolversTypes['ProductOption']>>,
    ParentType,
    ContextType
  >;
  originCountry?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  tags?: Resolver<
    Maybe<Array<ResolversTypes['ProductTag']>>,
    ParentType,
    ContextType
  >;
  thumbnail?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  variants?: Resolver<
    Maybe<Array<ResolversTypes['ProductVariant']>>,
    ParentType,
    ContextType
  >;
  weight?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  width?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type ProductCategoryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductCategory'] =
    ResolversParentTypes['ProductCategory'],
> = {
  categoryChildren?: Resolver<
    Maybe<Array<ResolversTypes['ProductCategory']>>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  handle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  parentCategory?: Resolver<
    Maybe<ResolversTypes['ProductCategory']>,
    ParentType,
    ContextType
  >;
  products?: Resolver<
    Maybe<ResolversTypes['ProductList']>,
    ParentType,
    ContextType
  >;
};

export type ProductHitResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductHit'] =
    ResolversParentTypes['ProductHit'],
> = {
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  handle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  thumbnail?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ProductImageResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductImage'] =
    ResolversParentTypes['ProductImage'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ProductListResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductList'] =
    ResolversParentTypes['ProductList'],
> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  items?: Resolver<
    Maybe<Array<ResolversTypes['Product']>>,
    ParentType,
    ContextType
  >;
};

export type ProductListResponseResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductListResponse'] =
    ResolversParentTypes['ProductListResponse'],
> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  products?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['Product']>>>,
    ParentType,
    ContextType
  >;
};

export type ProductOptionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductOption'] =
    ResolversParentTypes['ProductOption'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  values?: Resolver<
    Array<ResolversTypes['ProductOptionValue']>,
    ParentType,
    ContextType
  >;
};

export type ProductOptionValueResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductOptionValue'] =
    ResolversParentTypes['ProductOptionValue'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ProductTagResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductTag'] =
    ResolversParentTypes['ProductTag'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type ProductVariantResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductVariant'] =
    ResolversParentTypes['ProductVariant'],
> = {
  allowBackorder?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  inventoryQuantity?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  manageInventory?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  options?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['ProductVariantOption']>>>,
    ParentType,
    ContextType
  >;
  originalPrice?: Resolver<
    Maybe<ResolversTypes['Price']>,
    ParentType,
    ContextType
  >;
  price?: Resolver<Maybe<ResolversTypes['Price']>, ParentType, ContextType>;
  product?: Resolver<Maybe<ResolversTypes['Product']>, ParentType, ContextType>;
  sku?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ProductVariantOptionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductVariantOption'] =
    ResolversParentTypes['ProductVariantOption'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  optionId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Query'] =
    ResolversParentTypes['Query'],
> = {
  collection?: Resolver<
    Maybe<ResolversTypes['Collection']>,
    ParentType,
    ContextType,
    RequireFields<QueryCollectionArgs, 'id'>
  >;
  collections?: Resolver<
    Array<ResolversTypes['Collection']>,
    ParentType,
    ContextType,
    Partial<QueryCollectionsArgs>
  >;
  product?: Resolver<
    Maybe<ResolversTypes['Product']>,
    ParentType,
    ContextType,
    RequireFields<QueryProductArgs, 'id'>
  >;
  productCategories?: Resolver<
    Array<ResolversTypes['ProductCategory']>,
    ParentType,
    ContextType,
    Partial<QueryProductCategoriesArgs>
  >;
  productCategory?: Resolver<
    Maybe<ResolversTypes['ProductCategory']>,
    ParentType,
    ContextType,
    RequireFields<QueryProductCategoryArgs, 'id'>
  >;
  products?: Resolver<
    ResolversTypes['ProductListResponse'],
    ParentType,
    ContextType,
    Partial<QueryProductsArgs>
  >;
  searchProducts?: Resolver<
    ResolversTypes['SearchProducts'],
    ParentType,
    ContextType,
    Partial<QuerySearchProductsArgs>
  >;
};

export type SearchProductsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['SearchProducts'] =
    ResolversParentTypes['SearchProducts'],
> = {
  hitsPerPage?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  items?: Resolver<
    Array<ResolversTypes['ProductHit']>,
    ParentType,
    ContextType
  >;
  page?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  params?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  query?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalPages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Collection?: CollectionResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Price?: PriceResolvers<ContextType>;
  Product?: ProductResolvers<ContextType>;
  ProductCategory?: ProductCategoryResolvers<ContextType>;
  ProductHit?: ProductHitResolvers<ContextType>;
  ProductImage?: ProductImageResolvers<ContextType>;
  ProductList?: ProductListResolvers<ContextType>;
  ProductListResponse?: ProductListResponseResolvers<ContextType>;
  ProductOption?: ProductOptionResolvers<ContextType>;
  ProductOptionValue?: ProductOptionValueResolvers<ContextType>;
  ProductTag?: ProductTagResolvers<ContextType>;
  ProductVariant?: ProductVariantResolvers<ContextType>;
  ProductVariantOption?: ProductVariantOptionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SearchProducts?: SearchProductsResolvers<ContextType>;
};

export type DirectiveResolvers<ContextType = GraphQLContext> = {
  cacheControl?: CacheControlDirectiveResolver<any, any, ContextType>;
};
