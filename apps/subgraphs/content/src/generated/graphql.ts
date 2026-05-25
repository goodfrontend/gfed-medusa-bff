import type {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';

import type { ContentGraphQLContext } from '../graphql/context';

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

export type BannerButton = {
  href?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  openInNewTab?: Maybe<Scalars['Boolean']['output']>;
};

export type ConversionInput = {
  amount: Scalars['Float']['input'];
  checkoutSignalId?: InputMaybe<Scalars['String']['input']>;
  currency: Scalars['String']['input'];
  deviceId: Scalars['String']['input'];
  items?: InputMaybe<Array<ConversionLineItemInput>>;
  orderId: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ConversionLineItemInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  productId: Scalars['String']['input'];
  quantity: Scalars['Int']['input'];
  variantId?: InputMaybe<Scalars['String']['input']>;
};

export type DecisionReasoning = {
  confidence: Scalars['Float']['output'];
  factors: Array<Scalars['String']['output']>;
  intent: Scalars['String']['output'];
  modelVersion: Scalars['String']['output'];
};

export type EngagementLevel = 'HIGH' | 'LOW' | 'MEDIUM';

export type ContextualBanner = {
  ctaHref: Scalars['String']['output'];
  ctaLabel?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  minPrice?: Maybe<Scalars['Float']['output']>;
  priority: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  trigger: Scalars['String']['output'];
};

export type Footer = {
  _id: Scalars['ID']['output'];
  _type: Scalars['String']['output'];
  copyright?: Maybe<Scalars['String']['output']>;
  poweredByCta?: Maybe<PartialRichText>;
  social?: Maybe<Array<SocialLink>>;
  storeName?: Maybe<Scalars['String']['output']>;
};

export type HomeBanner = {
  _id: Scalars['ID']['output'];
  _type: Scalars['String']['output'];
  buttons?: Maybe<Array<BannerButton>>;
  description?: Maybe<Scalars['String']['output']>;
  eyebrow?: Maybe<Scalars['String']['output']>;
  image?: Maybe<SanityImage>;
  secondaryBanners?: Maybe<Array<SecondaryBanner>>;
  showPoweredBy?: Maybe<Scalars['Boolean']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type IntentSignals = {
  cartToPurchaseRate: Scalars['Float']['output'];
  researchDepth: Scalars['Float']['output'];
  returnRate: Scalars['Float']['output'];
};

export type LifecycleStage = 'FREQUENT' | 'LOYAL' | 'NEW' | 'RETURNING';

export type Mutation = {
  sendSignal: SendSignalResponse;
  submitConversion: Scalars['Boolean']['output'];
};

export type MutationSendSignalArgs = {
  input: SignalInput;
};

export type MutationSubmitConversionArgs = {
  input: ConversionInput;
};

export type PartialRichText = {
  text?: Maybe<Scalars['JSON']['output']>;
};

export type PersonalizationResult = {
  cacheKey: Scalars['String']['output'];
  components: Array<PersonalizedComponent>;
  reasoning: DecisionReasoning;
  servedAt: Scalars['String']['output'];
};

export type PersonalizedComponent = {
  component: Scalars['String']['output'];
  contentId?: Maybe<Scalars['String']['output']>;
  priority: Scalars['Int']['output'];
  propsOverrides?: Maybe<Scalars['JSON']['output']>;
  reasoning: Scalars['String']['output'];
  score: Scalars['Float']['output'];
};

export type PriceSensitivity = {
  avgViewedPrice: Scalars['Float']['output'];
  dealClickRate: Scalars['Float']['output'];
  score: Scalars['Float']['output'];
};

export type ProductViewEntry = {
  category: Scalars['String']['output'];
  price?: Maybe<Scalars['Float']['output']>;
  productId: Scalars['String']['output'];
  timestamp: Scalars['Float']['output'];
};

export type Query = {
  /** Debug: current rule-based intent classification. */
  debugIntent: DecisionReasoning;
  contextualBanners: Array<ContextualBanner>;
  footer?: Maybe<Footer>;
  homeBanner?: Maybe<HomeBanner>;
  personalize: PersonalizationResult;
  userProfile: UserProfile;
};

export type QueryDebugIntentArgs = {
  deviceId: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryHomeBannerArgs = {
  audience?: InputMaybe<Scalars['String']['input']>;
  segment?: InputMaybe<Scalars['String']['input']>;
};

export type QueryPersonalizeArgs = {
  deviceId: Scalars['String']['input'];
  input: SurfaceContext;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryUserProfileArgs = {
  deviceId: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SanityImage = {
  alt?: Maybe<Scalars['String']['output']>;
  asset?: Maybe<SanityImageAsset>;
};

export type SanityImageAsset = {
  url?: Maybe<Scalars['String']['output']>;
};

export type SearchHistoryEntry = {
  query: Scalars['String']['output'];
  timestamp: Scalars['Float']['output'];
};

export type SecondaryBanner = {
  button?: Maybe<BannerButton>;
  description?: Maybe<Scalars['String']['output']>;
  image?: Maybe<SanityImage>;
  showPoweredBy?: Maybe<Scalars['Boolean']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type SendSignalResponse = {
  profileUpdated: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
};

export type SignalInput = {
  deviceId?: InputMaybe<Scalars['String']['input']>;
  payload?: InputMaybe<Scalars['JSON']['input']>;
  /** Unix epoch milliseconds */
  timestamp?: InputMaybe<Scalars['Float']['input']>;
  type: SignalType;
  url?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type SignalType =
  | 'CART_ADD'
  | 'CART_REMOVE'
  | 'CART_UPDATE_QUANTITY'
  | 'CHECKOUT_ABANDON'
  | 'CHECKOUT_START'
  | 'EXIT_INTENT'
  | 'FILTER_APPLIED'
  | 'IMAGE_ZOOM'
  | 'PAGE_VIEW'
  | 'PRODUCT_HOVER'
  | 'PRODUCT_VIEW'
  | 'QUICK_VIEW_OPEN'
  | 'RETURN_POLICY_VIEW'
  | 'REVIEWS_VIEW'
  | 'SCROLL_DEPTH'
  | 'SEARCH_QUERY'
  | 'SEARCH_REFINE'
  | 'SEARCH_RESULT_CLICK'
  | 'SECURITY_INFO_VIEW'
  | 'SIZE_GUIDE_VIEW'
  | 'SORT_CHANGED'
  | 'TAB_SWITCH'
  | 'TIME_ON_PAGE'
  | 'TRUST_BADGE_CLICK';

export type SocialLink = {
  text: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type SurfaceContext = {
  cartValue?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  page: Scalars['String']['input'];
  price?: InputMaybe<Scalars['Float']['input']>;
  productId?: InputMaybe<Scalars['String']['input']>;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
  surface: Scalars['String']['input'];
};

export type UserProfile = {
  cartActivity?: Maybe<Scalars['Int']['output']>;
  categoryAffinity: Scalars['JSON']['output'];
  deviceId: Scalars['String']['output'];
  engagementLevel: EngagementLevel;
  firstSeen: Scalars['Float']['output'];
  hesitationCount?: Maybe<Scalars['Int']['output']>;
  intentSignals: IntentSignals;
  lastSeen: Scalars['Float']['output'];
  lastSignalTimestamp?: Maybe<Scalars['Float']['output']>;
  lifecycleStage: LifecycleStage;
  orderCount?: Maybe<Scalars['Int']['output']>;
  priceSensitivity: PriceSensitivity;
  recentProducts?: Maybe<Array<ProductViewEntry>>;
  searchHistory?: Maybe<Array<SearchHistoryEntry>>;
  sessionCount: Scalars['Int']['output'];
  userId?: Maybe<Scalars['String']['output']>;
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
  BannerButton: ResolverTypeWrapper<BannerButton>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  ConversionInput: ConversionInput;
  ConversionLineItemInput: ConversionLineItemInput;
  ContextualBanner: ResolverTypeWrapper<ContextualBanner>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DecisionReasoning: ResolverTypeWrapper<DecisionReasoning>;
  EngagementLevel: EngagementLevel;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Footer: ResolverTypeWrapper<Footer>;
  HomeBanner: ResolverTypeWrapper<HomeBanner>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  IntentSignals: ResolverTypeWrapper<IntentSignals>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LifecycleStage: LifecycleStage;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PartialRichText: ResolverTypeWrapper<PartialRichText>;
  PersonalizationResult: ResolverTypeWrapper<PersonalizationResult>;
  PersonalizedComponent: ResolverTypeWrapper<PersonalizedComponent>;
  PriceSensitivity: ResolverTypeWrapper<PriceSensitivity>;
  ProductViewEntry: ResolverTypeWrapper<ProductViewEntry>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SanityImage: ResolverTypeWrapper<SanityImage>;
  SanityImageAsset: ResolverTypeWrapper<SanityImageAsset>;
  SearchHistoryEntry: ResolverTypeWrapper<SearchHistoryEntry>;
  SecondaryBanner: ResolverTypeWrapper<SecondaryBanner>;
  SendSignalResponse: ResolverTypeWrapper<SendSignalResponse>;
  SignalInput: SignalInput;
  SignalType: SignalType;
  SocialLink: ResolverTypeWrapper<SocialLink>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SurfaceContext: SurfaceContext;
  UserProfile: ResolverTypeWrapper<UserProfile>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  BannerButton: BannerButton;
  Boolean: Scalars['Boolean']['output'];
  ConversionInput: ConversionInput;
  ConversionLineItemInput: ConversionLineItemInput;
  ContextualBanner: ContextualBanner;
  DateTime: Scalars['DateTime']['output'];
  DecisionReasoning: DecisionReasoning;
  Float: Scalars['Float']['output'];
  Float: Scalars['Float']['output'];
  Footer: Footer;
  HomeBanner: HomeBanner;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  IntentSignals: IntentSignals;
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  Mutation: Record<PropertyKey, never>;
  PartialRichText: PartialRichText;
  PersonalizationResult: PersonalizationResult;
  PersonalizedComponent: PersonalizedComponent;
  PriceSensitivity: PriceSensitivity;
  ProductViewEntry: ProductViewEntry;
  Query: Record<PropertyKey, never>;
  SanityImage: SanityImage;
  SanityImageAsset: SanityImageAsset;
  SearchHistoryEntry: SearchHistoryEntry;
  SecondaryBanner: SecondaryBanner;
  SendSignalResponse: SendSignalResponse;
  SignalInput: SignalInput;
  SocialLink: SocialLink;
  String: Scalars['String']['output'];
  SurfaceContext: SurfaceContext;
  UserProfile: UserProfile;
};

export type BannerButtonResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['BannerButton'] =
    ResolversParentTypes['BannerButton'],
> = {
  href?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  openInNewTab?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
};

export type ContextualBannerResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['ContextualBanner'] =
    ResolversParentTypes['ContextualBanner'],
> = {
  ctaHref?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ctaLabel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  minPrice?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  priority?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  trigger?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['DateTime'],
  any
> {
  name: 'DateTime';
}

export type DecisionReasoningResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['DecisionReasoning'] =
    ResolversParentTypes['DecisionReasoning'],
> = {
  confidence?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  factors?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  intent?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  modelVersion?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type FooterResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['Footer'] =
    ResolversParentTypes['Footer'],
> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  _type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  copyright?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  poweredByCta?: Resolver<
    Maybe<ResolversTypes['PartialRichText']>,
    ParentType,
    ContextType
  >;
  social?: Resolver<
    Maybe<Array<ResolversTypes['SocialLink']>>,
    ParentType,
    ContextType
  >;
  storeName?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
};

export type HomeBannerResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['HomeBanner'] =
    ResolversParentTypes['HomeBanner'],
> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  _type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  buttons?: Resolver<
    Maybe<Array<ResolversTypes['BannerButton']>>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  eyebrow?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  image?: Resolver<
    Maybe<ResolversTypes['SanityImage']>,
    ParentType,
    ContextType
  >;
  secondaryBanners?: Resolver<
    Maybe<Array<ResolversTypes['SecondaryBanner']>>,
    ParentType,
    ContextType
  >;
  showPoweredBy?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type IntentSignalsResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['IntentSignals'] =
    ResolversParentTypes['IntentSignals'],
> = {
  cartToPurchaseRate?: Resolver<
    ResolversTypes['Float'],
    ParentType,
    ContextType
  >;
  researchDepth?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  returnRate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['JSON'],
  any
> {
  name: 'JSON';
}

export type MutationResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['Mutation'] =
    ResolversParentTypes['Mutation'],
> = {
  sendSignal?: Resolver<
    ResolversTypes['SendSignalResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationSendSignalArgs, 'input'>
  >;
  submitConversion?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationSubmitConversionArgs, 'input'>
  >;
};

export type PartialRichTextResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['PartialRichText'] =
    ResolversParentTypes['PartialRichText'],
> = {
  text?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
};

export type PersonalizationResultResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['PersonalizationResult'] =
    ResolversParentTypes['PersonalizationResult'],
> = {
  cacheKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  components?: Resolver<
    Array<ResolversTypes['PersonalizedComponent']>,
    ParentType,
    ContextType
  >;
  reasoning?: Resolver<
    ResolversTypes['DecisionReasoning'],
    ParentType,
    ContextType
  >;
  servedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PersonalizedComponentResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['PersonalizedComponent'] =
    ResolversParentTypes['PersonalizedComponent'],
> = {
  component?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  priority?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  propsOverrides?: Resolver<
    Maybe<ResolversTypes['JSON']>,
    ParentType,
    ContextType
  >;
  reasoning?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type PriceSensitivityResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['PriceSensitivity'] =
    ResolversParentTypes['PriceSensitivity'],
> = {
  avgViewedPrice?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  dealClickRate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type ProductViewEntryResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['ProductViewEntry'] =
    ResolversParentTypes['ProductViewEntry'],
> = {
  category?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  price?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  productId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['Query'] =
    ResolversParentTypes['Query'],
> = {
  debugIntent?: Resolver<
    ResolversTypes['DecisionReasoning'],
    ParentType,
    ContextType,
    RequireFields<QueryDebugIntentArgs, 'deviceId'>
  >;
  contextualBanners?: Resolver<
    Array<ResolversTypes['ContextualBanner']>,
    ParentType,
    ContextType
  >;
  footer?: Resolver<Maybe<ResolversTypes['Footer']>, ParentType, ContextType>;
  homeBanner?: Resolver<
    Maybe<ResolversTypes['HomeBanner']>,
    ParentType,
    ContextType,
    Partial<QueryHomeBannerArgs>
  >;
  personalize?: Resolver<
    ResolversTypes['PersonalizationResult'],
    ParentType,
    ContextType,
    RequireFields<QueryPersonalizeArgs, 'deviceId' | 'input'>
  >;
  userProfile?: Resolver<
    ResolversTypes['UserProfile'],
    ParentType,
    ContextType,
    RequireFields<QueryUserProfileArgs, 'deviceId'>
  >;
};

export type SanityImageResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SanityImage'] =
    ResolversParentTypes['SanityImage'],
> = {
  alt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  asset?: Resolver<
    Maybe<ResolversTypes['SanityImageAsset']>,
    ParentType,
    ContextType
  >;
};

export type SanityImageAssetResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SanityImageAsset'] =
    ResolversParentTypes['SanityImageAsset'],
> = {
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type SearchHistoryEntryResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SearchHistoryEntry'] =
    ResolversParentTypes['SearchHistoryEntry'],
> = {
  query?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type SecondaryBannerResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SecondaryBanner'] =
    ResolversParentTypes['SecondaryBanner'],
> = {
  button?: Resolver<
    Maybe<ResolversTypes['BannerButton']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  image?: Resolver<
    Maybe<ResolversTypes['SanityImage']>,
    ParentType,
    ContextType
  >;
  showPoweredBy?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type SendSignalResponseResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SendSignalResponse'] =
    ResolversParentTypes['SendSignalResponse'],
> = {
  profileUpdated?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type SocialLinkResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['SocialLink'] =
    ResolversParentTypes['SocialLink'],
> = {
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type UserProfileResolvers<
  ContextType = ContentGraphQLContext,
  ParentType extends ResolversParentTypes['UserProfile'] =
    ResolversParentTypes['UserProfile'],
> = {
  cartActivity?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  categoryAffinity?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  deviceId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  engagementLevel?: Resolver<
    ResolversTypes['EngagementLevel'],
    ParentType,
    ContextType
  >;
  firstSeen?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  hesitationCount?: Resolver<
    Maybe<ResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  intentSignals?: Resolver<
    ResolversTypes['IntentSignals'],
    ParentType,
    ContextType
  >;
  lastSeen?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  lastSignalTimestamp?: Resolver<
    Maybe<ResolversTypes['Float']>,
    ParentType,
    ContextType
  >;
  lifecycleStage?: Resolver<
    ResolversTypes['LifecycleStage'],
    ParentType,
    ContextType
  >;
  orderCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  priceSensitivity?: Resolver<
    ResolversTypes['PriceSensitivity'],
    ParentType,
    ContextType
  >;
  recentProducts?: Resolver<
    Maybe<Array<ResolversTypes['ProductViewEntry']>>,
    ParentType,
    ContextType
  >;
  searchHistory?: Resolver<
    Maybe<Array<ResolversTypes['SearchHistoryEntry']>>,
    ParentType,
    ContextType
  >;
  sessionCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = ContentGraphQLContext> = {
  BannerButton?: BannerButtonResolvers<ContextType>;
  ContextualBanner?: ContextualBannerResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DecisionReasoning?: DecisionReasoningResolvers<ContextType>;
  Footer?: FooterResolvers<ContextType>;
  HomeBanner?: HomeBannerResolvers<ContextType>;
  IntentSignals?: IntentSignalsResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  Mutation?: MutationResolvers<ContextType>;
  PartialRichText?: PartialRichTextResolvers<ContextType>;
  PersonalizationResult?: PersonalizationResultResolvers<ContextType>;
  PersonalizedComponent?: PersonalizedComponentResolvers<ContextType>;
  PriceSensitivity?: PriceSensitivityResolvers<ContextType>;
  ProductViewEntry?: ProductViewEntryResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SanityImage?: SanityImageResolvers<ContextType>;
  SanityImageAsset?: SanityImageAssetResolvers<ContextType>;
  SearchHistoryEntry?: SearchHistoryEntryResolvers<ContextType>;
  SecondaryBanner?: SecondaryBannerResolvers<ContextType>;
  SendSignalResponse?: SendSignalResponseResolvers<ContextType>;
  SocialLink?: SocialLinkResolvers<ContextType>;
  UserProfile?: UserProfileResolvers<ContextType>;
};
