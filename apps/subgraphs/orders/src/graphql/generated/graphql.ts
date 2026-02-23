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
  JSON: {
    input: { [key: string]: unknown };
    output: { [key: string]: unknown };
  };
};

export type Address = {
  address1?: Maybe<Scalars['String']['output']>;
  address2?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  company?: Maybe<Scalars['String']['output']>;
  countryCode?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  lastName?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  postalCode?: Maybe<Scalars['String']['output']>;
  province?: Maybe<Scalars['String']['output']>;
};

export type AddressInput = {
  address1?: InputMaybe<Scalars['String']['input']>;
  address2?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  company?: InputMaybe<Scalars['String']['input']>;
  countryCode?: InputMaybe<Scalars['String']['input']>;
  customerId?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  postalCode?: InputMaybe<Scalars['String']['input']>;
  province?: InputMaybe<Scalars['String']['input']>;
};

export type ApplicationMethod = {
  currencyCode: Scalars['String']['output'];
  type: ApplicationType;
  value: Scalars['String']['output'];
};

export type ApplicationType = 'fixed' | 'percentage';

export type CacheControlScope = 'PRIVATE' | 'PUBLIC';

export type Cart = {
  billingAddress?: Maybe<Address>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currencyCode: Scalars['String']['output'];
  customerId?: Maybe<Scalars['String']['output']>;
  discountTotal: Scalars['Int']['output'];
  email?: Maybe<Scalars['String']['output']>;
  giftCardTotal: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  itemTotal: Scalars['Int']['output'];
  items?: Maybe<Array<LineItem>>;
  originalTotal: Scalars['Int']['output'];
  paymentCollection?: Maybe<PaymentCollection>;
  promoCodes?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  promotions: Array<Maybe<Promotion>>;
  region?: Maybe<Region>;
  regionId?: Maybe<Scalars['String']['output']>;
  shippingAddress?: Maybe<Address>;
  shippingMethods?: Maybe<Array<Maybe<ShippingMethod>>>;
  shippingTotal: Scalars['Int']['output'];
  subtotal: Scalars['Int']['output'];
  taxTotal: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type CompleteCartError = {
  message: Scalars['String']['output'];
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type CompleteCartErrorResult = {
  cart?: Maybe<Cart>;
  error?: Maybe<CompleteCartError>;
  type: Scalars['String']['output'];
};

export type CompleteCartOrderResult = {
  order?: Maybe<Order>;
  type: Scalars['String']['output'];
};

export type CompleteCartResponse =
  | CompleteCartErrorResult
  | CompleteCartOrderResult;

export type Country = {
  displayName?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  iso2?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type CreateCartInput = {
  billingAddress?: InputMaybe<AddressInput>;
  currencyCode?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  items?: InputMaybe<Array<CreateLineItemInput>>;
  promoCodes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  regionId?: InputMaybe<Scalars['String']['input']>;
  shippingAddress?: InputMaybe<AddressInput>;
};

export type CreateLineItemInput = {
  quantity: Scalars['Int']['input'];
  variantId: Scalars['String']['input'];
};

export type LineItem = {
  cart?: Maybe<Cart>;
  cartId?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  originalTotal?: Maybe<Scalars['Int']['output']>;
  productHandle?: Maybe<Scalars['String']['output']>;
  productTitle?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Int']['output'];
  requiresShipping?: Maybe<Scalars['Boolean']['output']>;
  thumbnail?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
  unitPrice?: Maybe<Scalars['Int']['output']>;
  variant?: Maybe<ProductVariant>;
};

export type Mutation = {
  addShippingMethod?: Maybe<Cart>;
  applyPromotions?: Maybe<Cart>;
  completeCart?: Maybe<CompleteCartResponse>;
  createCart?: Maybe<Cart>;
  createLineItem?: Maybe<Cart>;
  deleteLineItem: StoreLineItemDeleteResponse;
  transferCart?: Maybe<Cart>;
  updateCart?: Maybe<Cart>;
  updateLineItem?: Maybe<Cart>;
};

export type MutationAddShippingMethodArgs = {
  cartId: Scalars['ID']['input'];
  optionId: Scalars['ID']['input'];
};

export type MutationApplyPromotionsArgs = {
  cartId: Scalars['ID']['input'];
  codes: Array<Scalars['String']['input']>;
};

export type MutationCompleteCartArgs = {
  cartId: Scalars['ID']['input'];
};

export type MutationCreateCartArgs = {
  data: CreateCartInput;
};

export type MutationCreateLineItemArgs = {
  cartId: Scalars['ID']['input'];
  data: CreateLineItemInput;
};

export type MutationDeleteLineItemArgs = {
  cartId: Scalars['ID']['input'];
  lineItemId: Scalars['ID']['input'];
};

export type MutationTransferCartArgs = {
  cartId: Scalars['ID']['input'];
};

export type MutationUpdateCartArgs = {
  data: UpdateCartInput;
  id: Scalars['ID']['input'];
};

export type MutationUpdateLineItemArgs = {
  cartId: Scalars['ID']['input'];
  data: UpdateLineItemInput;
  lineItemId: Scalars['ID']['input'];
};

export type Order = {
  createdAt: Scalars['DateTime']['output'];
  currencyCode: Scalars['String']['output'];
  customerId: Scalars['String']['output'];
  discountTotal?: Maybe<Scalars['Int']['output']>;
  displayId?: Maybe<Scalars['Int']['output']>;
  email: Scalars['String']['output'];
  fulfillmentStatus: Scalars['String']['output'];
  giftCardTotal?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  items: Array<LineItem>;
  paymentCollections?: Maybe<Array<Maybe<PaymentCollection>>>;
  paymentStatus: Scalars['String']['output'];
  regionId: Scalars['String']['output'];
  shippingAddress?: Maybe<Address>;
  shippingMethods: Array<ShippingMethod>;
  shippingTotal?: Maybe<Scalars['Int']['output']>;
  status: Scalars['String']['output'];
  subtotal?: Maybe<Scalars['Int']['output']>;
  taxTotal?: Maybe<Scalars['Int']['output']>;
  total: Scalars['Int']['output'];
};

export type Payment = {
  amount: Scalars['Int']['output'];
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currencyCode: Scalars['String']['output'];
  data?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['String']['output'];
  providerId: Scalars['String']['output'];
};

export type PaymentCollection = {
  amount: Scalars['Int']['output'];
  currencyCode: Scalars['String']['output'];
  id: Scalars['String']['output'];
  paymentProviders: Array<Maybe<PaymentProviders>>;
  paymentSessions?: Maybe<Array<Maybe<PaymentSessions>>>;
  payments?: Maybe<Array<Maybe<Payment>>>;
  status: PaymentStatus;
};

export type PaymentProviders = {
  id: Scalars['String']['output'];
};

export type PaymentSessionStatus =
  | 'authorized'
  | 'canceled'
  | 'captured'
  | 'error'
  | 'pending'
  | 'requires_more';

export type PaymentSessions = {
  amount: Scalars['Int']['output'];
  currencyCode: Scalars['String']['output'];
  data: Scalars['JSON']['output'];
  id: Scalars['String']['output'];
  providerId: Scalars['String']['output'];
  status: PaymentSessionStatus;
};

export type PaymentStatus =
  | 'authorized'
  | 'awaiting'
  | 'canceled'
  | 'not_paid'
  | 'partially_authorized';

export type ProductVariant = {
  id: Scalars['ID']['output'];
};

export type Promotion = {
  applicationMethod?: Maybe<ApplicationMethod>;
  code?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  isAutomatic?: Maybe<Scalars['Boolean']['output']>;
};

export type Query = {
  cart?: Maybe<Cart>;
};

export type QueryCartArgs = {
  id: Scalars['ID']['input'];
};

export type Region = {
  countries?: Maybe<Array<Maybe<Country>>>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currencyCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ShippingMethod = {
  amount: Scalars['Int']['output'];
  cartId?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  shippingOptionId?: Maybe<Scalars['String']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
};

export type StoreLineItemDeleteResponse = {
  deleted: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  object?: Maybe<Scalars['String']['output']>;
};

export type UpdateCartInput = {
  billingAddress?: InputMaybe<AddressInput>;
  email?: InputMaybe<Scalars['String']['input']>;
  promoCodes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  regionId?: InputMaybe<Scalars['String']['input']>;
  shippingAddress?: InputMaybe<AddressInput>;
};

export type UpdateLineItemInput = {
  quantity: Scalars['Int']['input'];
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

/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = {
  CompleteCartResponse: CompleteCartErrorResult | CompleteCartOrderResult;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Address: ResolverTypeWrapper<Address>;
  AddressInput: AddressInput;
  ApplicationMethod: ResolverTypeWrapper<ApplicationMethod>;
  ApplicationType: ApplicationType;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CacheControlScope: CacheControlScope;
  Cart: ResolverTypeWrapper<Cart>;
  CompleteCartError: ResolverTypeWrapper<CompleteCartError>;
  CompleteCartErrorResult: ResolverTypeWrapper<CompleteCartErrorResult>;
  CompleteCartOrderResult: ResolverTypeWrapper<CompleteCartOrderResult>;
  CompleteCartResponse: ResolverTypeWrapper<
    ResolversUnionTypes<ResolversTypes>['CompleteCartResponse']
  >;
  Country: ResolverTypeWrapper<Country>;
  CreateCartInput: CreateCartInput;
  CreateLineItemInput: CreateLineItemInput;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LineItem: ResolverTypeWrapper<LineItem>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Order: ResolverTypeWrapper<Order>;
  Payment: ResolverTypeWrapper<Payment>;
  PaymentCollection: ResolverTypeWrapper<PaymentCollection>;
  PaymentProviders: ResolverTypeWrapper<PaymentProviders>;
  PaymentSessionStatus: PaymentSessionStatus;
  PaymentSessions: ResolverTypeWrapper<PaymentSessions>;
  PaymentStatus: PaymentStatus;
  ProductVariant: ResolverTypeWrapper<ProductVariant>;
  Promotion: ResolverTypeWrapper<Promotion>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Region: ResolverTypeWrapper<Region>;
  ShippingMethod: ResolverTypeWrapper<ShippingMethod>;
  StoreLineItemDeleteResponse: ResolverTypeWrapper<StoreLineItemDeleteResponse>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  UpdateCartInput: UpdateCartInput;
  UpdateLineItemInput: UpdateLineItemInput;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Address: Address;
  AddressInput: AddressInput;
  ApplicationMethod: ApplicationMethod;
  Boolean: Scalars['Boolean']['output'];
  Cart: Cart;
  CompleteCartError: CompleteCartError;
  CompleteCartErrorResult: CompleteCartErrorResult;
  CompleteCartOrderResult: CompleteCartOrderResult;
  CompleteCartResponse: ResolversUnionTypes<ResolversParentTypes>['CompleteCartResponse'];
  Country: Country;
  CreateCartInput: CreateCartInput;
  CreateLineItemInput: CreateLineItemInput;
  DateTime: Scalars['DateTime']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  LineItem: LineItem;
  Mutation: Record<PropertyKey, never>;
  Order: Order;
  Payment: Payment;
  PaymentCollection: PaymentCollection;
  PaymentProviders: PaymentProviders;
  PaymentSessions: PaymentSessions;
  ProductVariant: ProductVariant;
  Promotion: Promotion;
  Query: Record<PropertyKey, never>;
  Region: Region;
  ShippingMethod: ShippingMethod;
  StoreLineItemDeleteResponse: StoreLineItemDeleteResponse;
  String: Scalars['String']['output'];
  UpdateCartInput: UpdateCartInput;
  UpdateLineItemInput: UpdateLineItemInput;
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

export type AddressResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Address'] =
    ResolversParentTypes['Address'],
> = {
  address1?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  address2?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  city?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  company?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  countryCode?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  firstName?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  phone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  postalCode?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  province?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ApplicationMethodResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ApplicationMethod'] =
    ResolversParentTypes['ApplicationMethod'],
> = {
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ApplicationType'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CartResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Cart'] =
    ResolversParentTypes['Cart'],
> = {
  billingAddress?: Resolver<
    Maybe<ResolversTypes['Address']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customerId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  discountTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  giftCardTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  itemTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  items?: Resolver<
    Maybe<Array<ResolversTypes['LineItem']>>,
    ParentType,
    ContextType
  >;
  originalTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  paymentCollection?: Resolver<
    Maybe<ResolversTypes['PaymentCollection']>,
    ParentType,
    ContextType
  >;
  promoCodes?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['String']>>>,
    ParentType,
    ContextType
  >;
  promotions?: Resolver<
    Array<Maybe<ResolversTypes['Promotion']>>,
    ParentType,
    ContextType
  >;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType>;
  regionId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  shippingAddress?: Resolver<
    Maybe<ResolversTypes['Address']>,
    ParentType,
    ContextType
  >;
  shippingMethods?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['ShippingMethod']>>>,
    ParentType,
    ContextType
  >;
  shippingTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  subtotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  taxTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CompleteCartErrorResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['CompleteCartError'] =
    ResolversParentTypes['CompleteCartError'],
> = {
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CompleteCartErrorResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['CompleteCartErrorResult'] =
    ResolversParentTypes['CompleteCartErrorResult'],
> = {
  cart?: Resolver<Maybe<ResolversTypes['Cart']>, ParentType, ContextType>;
  error?: Resolver<
    Maybe<ResolversTypes['CompleteCartError']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CompleteCartOrderResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['CompleteCartOrderResult'] =
    ResolversParentTypes['CompleteCartOrderResult'],
> = {
  order?: Resolver<Maybe<ResolversTypes['Order']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CompleteCartResponseResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['CompleteCartResponse'] =
    ResolversParentTypes['CompleteCartResponse'],
> = {
  __resolveType: TypeResolveFn<
    'CompleteCartErrorResult' | 'CompleteCartOrderResult',
    ParentType,
    ContextType
  >;
};

export type CountryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Country'] =
    ResolversParentTypes['Country'],
> = {
  displayName?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  iso2?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['DateTime'],
  any
> {
  name: 'DateTime';
}

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['JSON'],
  any
> {
  name: 'JSON';
}

export type LineItemResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['LineItem'] =
    ResolversParentTypes['LineItem'],
> = {
  cart?: Resolver<Maybe<ResolversTypes['Cart']>, ParentType, ContextType>;
  cartId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  originalTotal?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  productHandle?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  productTitle?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  quantity?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  requiresShipping?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  thumbnail?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  total?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  unitPrice?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  variant?: Resolver<
    Maybe<ResolversTypes['ProductVariant']>,
    ParentType,
    ContextType
  >;
};

export type MutationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Mutation'] =
    ResolversParentTypes['Mutation'],
> = {
  addShippingMethod?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationAddShippingMethodArgs, 'cartId' | 'optionId'>
  >;
  applyPromotions?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationApplyPromotionsArgs, 'cartId' | 'codes'>
  >;
  completeCart?: Resolver<
    Maybe<ResolversTypes['CompleteCartResponse']>,
    ParentType,
    ContextType,
    RequireFields<MutationCompleteCartArgs, 'cartId'>
  >;
  createCart?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationCreateCartArgs, 'data'>
  >;
  createLineItem?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationCreateLineItemArgs, 'cartId' | 'data'>
  >;
  deleteLineItem?: Resolver<
    ResolversTypes['StoreLineItemDeleteResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteLineItemArgs, 'cartId' | 'lineItemId'>
  >;
  transferCart?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationTransferCartArgs, 'cartId'>
  >;
  updateCart?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationUpdateCartArgs, 'data' | 'id'>
  >;
  updateLineItem?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<MutationUpdateLineItemArgs, 'cartId' | 'data' | 'lineItemId'>
  >;
};

export type OrderResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Order'] =
    ResolversParentTypes['Order'],
> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  discountTotal?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  displayId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fulfillmentStatus?: Resolver<
    ResolversTypes['String'],
    ParentType,
    ContextType
  >;
  giftCardTotal?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['LineItem']>, ParentType, ContextType>;
  paymentCollections?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['PaymentCollection']>>>,
    ParentType,
    ContextType
  >;
  paymentStatus?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  regionId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  shippingAddress?: Resolver<
    Maybe<ResolversTypes['Address']>,
    ParentType,
    ContextType
  >;
  shippingMethods?: Resolver<
    Array<ResolversTypes['ShippingMethod']>,
    ParentType,
    ContextType
  >;
  shippingTotal?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subtotal?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  taxTotal?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type PaymentResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Payment'] =
    ResolversParentTypes['Payment'],
> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  data?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  providerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PaymentCollectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['PaymentCollection'] =
    ResolversParentTypes['PaymentCollection'],
> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paymentProviders?: Resolver<
    Array<Maybe<ResolversTypes['PaymentProviders']>>,
    ParentType,
    ContextType
  >;
  paymentSessions?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['PaymentSessions']>>>,
    ParentType,
    ContextType
  >;
  payments?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['Payment']>>>,
    ParentType,
    ContextType
  >;
  status?: Resolver<ResolversTypes['PaymentStatus'], ParentType, ContextType>;
};

export type PaymentProvidersResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['PaymentProviders'] =
    ResolversParentTypes['PaymentProviders'],
> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PaymentSessionsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['PaymentSessions'] =
    ResolversParentTypes['PaymentSessions'],
> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  data?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  providerId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<
    ResolversTypes['PaymentSessionStatus'],
    ParentType,
    ContextType
  >;
};

export type ProductVariantResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ProductVariant'] =
    ResolversParentTypes['ProductVariant'],
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type PromotionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Promotion'] =
    ResolversParentTypes['Promotion'],
> = {
  applicationMethod?: Resolver<
    Maybe<ResolversTypes['ApplicationMethod']>,
    ParentType,
    ContextType
  >;
  code?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isAutomatic?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
};

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Query'] =
    ResolversParentTypes['Query'],
> = {
  cart?: Resolver<
    Maybe<ResolversTypes['Cart']>,
    ParentType,
    ContextType,
    RequireFields<QueryCartArgs, 'id'>
  >;
};

export type RegionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['Region'] =
    ResolversParentTypes['Region'],
> = {
  countries?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['Country']>>>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ShippingMethodResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['ShippingMethod'] =
    ResolversParentTypes['ShippingMethod'],
> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  cartId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<
    Maybe<ResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  shippingOptionId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  total?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type StoreLineItemDeleteResponseResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes['StoreLineItemDeleteResponse'] =
    ResolversParentTypes['StoreLineItemDeleteResponse'],
> = {
  deleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  object?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Address?: AddressResolvers<ContextType>;
  ApplicationMethod?: ApplicationMethodResolvers<ContextType>;
  Cart?: CartResolvers<ContextType>;
  CompleteCartError?: CompleteCartErrorResolvers<ContextType>;
  CompleteCartErrorResult?: CompleteCartErrorResultResolvers<ContextType>;
  CompleteCartOrderResult?: CompleteCartOrderResultResolvers<ContextType>;
  CompleteCartResponse?: CompleteCartResponseResolvers<ContextType>;
  Country?: CountryResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  JSON?: GraphQLScalarType;
  LineItem?: LineItemResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Order?: OrderResolvers<ContextType>;
  Payment?: PaymentResolvers<ContextType>;
  PaymentCollection?: PaymentCollectionResolvers<ContextType>;
  PaymentProviders?: PaymentProvidersResolvers<ContextType>;
  PaymentSessions?: PaymentSessionsResolvers<ContextType>;
  ProductVariant?: ProductVariantResolvers<ContextType>;
  Promotion?: PromotionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Region?: RegionResolvers<ContextType>;
  ShippingMethod?: ShippingMethodResolvers<ContextType>;
  StoreLineItemDeleteResponse?: StoreLineItemDeleteResponseResolvers<ContextType>;
};

export type DirectiveResolvers<ContextType = GraphQLContext> = {
  cacheControl?: CacheControlDirectiveResolver<any, any, ContextType>;
};
