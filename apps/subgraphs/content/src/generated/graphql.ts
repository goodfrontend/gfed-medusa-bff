import type {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';

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

export type PartialRichText = {
  text?: Maybe<Scalars['JSON']['output']>;
};

export type Query = {
  footer?: Maybe<Footer>;
  homeBanner?: Maybe<HomeBanner>;
};

export type SanityImage = {
  alt?: Maybe<Scalars['String']['output']>;
  asset?: Maybe<SanityImageAsset>;
};

export type SanityImageAsset = {
  url?: Maybe<Scalars['String']['output']>;
};

export type SecondaryBanner = {
  button?: Maybe<BannerButton>;
  description?: Maybe<Scalars['String']['output']>;
  image?: Maybe<SanityImage>;
  showPoweredBy?: Maybe<Scalars['Boolean']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type SocialLink = {
  text: Scalars['String']['output'];
  url: Scalars['String']['output'];
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
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Footer: ResolverTypeWrapper<Footer>;
  HomeBanner: ResolverTypeWrapper<HomeBanner>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  PartialRichText: ResolverTypeWrapper<PartialRichText>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SanityImage: ResolverTypeWrapper<SanityImage>;
  SanityImageAsset: ResolverTypeWrapper<SanityImageAsset>;
  SecondaryBanner: ResolverTypeWrapper<SecondaryBanner>;
  SocialLink: ResolverTypeWrapper<SocialLink>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  BannerButton: BannerButton;
  Boolean: Scalars['Boolean']['output'];
  DateTime: Scalars['DateTime']['output'];
  Footer: Footer;
  HomeBanner: HomeBanner;
  ID: Scalars['ID']['output'];
  JSON: Scalars['JSON']['output'];
  PartialRichText: PartialRichText;
  Query: Record<PropertyKey, never>;
  SanityImage: SanityImage;
  SanityImageAsset: SanityImageAsset;
  SecondaryBanner: SecondaryBanner;
  SocialLink: SocialLink;
  String: Scalars['String']['output'];
};

export type BannerButtonResolvers<
  ContextType = any,
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

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['DateTime'],
  any
> {
  name: 'DateTime';
}

export type FooterResolvers<
  ContextType = any,
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
  ContextType = any,
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

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes['JSON'],
  any
> {
  name: 'JSON';
}

export type PartialRichTextResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['PartialRichText'] =
    ResolversParentTypes['PartialRichText'],
> = {
  text?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Query'] =
    ResolversParentTypes['Query'],
> = {
  footer?: Resolver<Maybe<ResolversTypes['Footer']>, ParentType, ContextType>;
  homeBanner?: Resolver<
    Maybe<ResolversTypes['HomeBanner']>,
    ParentType,
    ContextType
  >;
};

export type SanityImageResolvers<
  ContextType = any,
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
  ContextType = any,
  ParentType extends ResolversParentTypes['SanityImageAsset'] =
    ResolversParentTypes['SanityImageAsset'],
> = {
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type SecondaryBannerResolvers<
  ContextType = any,
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

export type SocialLinkResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['SocialLink'] =
    ResolversParentTypes['SocialLink'],
> = {
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  BannerButton?: BannerButtonResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Footer?: FooterResolvers<ContextType>;
  HomeBanner?: HomeBannerResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  PartialRichText?: PartialRichTextResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SanityImage?: SanityImageResolvers<ContextType>;
  SanityImageAsset?: SanityImageAssetResolvers<ContextType>;
  SecondaryBanner?: SecondaryBannerResolvers<ContextType>;
  SocialLink?: SocialLinkResolvers<ContextType>;
};
