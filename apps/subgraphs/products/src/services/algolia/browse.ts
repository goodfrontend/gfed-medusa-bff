import { type SearchClient, algoliasearch } from 'algoliasearch';

import { BROWSE_ATTRIBUTES_TO_RETRIEVE } from '../../constants/algolia';

export type BrowseProductsSort = 'LATEST' | 'PRICE_ASC' | 'PRICE_DESC';

export type BrowseProductsArgs = {
  countryCode?: string | null;
  regionId?: string | null;
  sort?: BrowseProductsSort | null;
  hitsPerPage?: number | null;
  page?: number | null;
  filters?: string | null;
  facets?: string[] | null;
};

export interface AlgoliaBrowseHit {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  handle: string;
  collection_id?: string | null;
  collection_handle?: string | null;
  category_ids?: string[] | null;
  category_handles?: string[] | null;
  is_sellable?: boolean | null;
  price_amount?: number | null;
  original_price_amount?: number | null;
  currency_code?: string | null;
  display_price?: string | null;
  display_original_price?: string | null;
}

export type BrowseProductItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  handle: string;
  collectionId?: string | null;
  collectionHandle?: string | null;
  categoryIds: string[];
  categoryHandles: string[];
  isSellable: boolean;
  priceAmount?: number | null;
  originalPriceAmount?: number | null;
  currencyCode?: string | null;
  displayPrice?: string | null;
  displayOriginalPrice?: string | null;
};

export type BrowseProductsResult = {
  total: number;
  page: number;
  totalPages: number;
  hitsPerPage: number;
  params: string;
  facets: Record<string, Record<string, number>> | null;
  items: BrowseProductItem[];
};

export type BrowseMarketKeyResolver = (params: {
  countryCode?: string | null;
  regionId?: string | null;
}) => Promise<string | null | undefined> | string | null | undefined;

const BROWSE_REPLICA_SUFFIX: Record<BrowseProductsSort, string> = {
  LATEST: '',
  PRICE_ASC: '_price_asc',
  PRICE_DESC: '_price_desc',
};

function sanitizeMarketKey(marketKey: string) {
  return marketKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function defaultResolveMarketKey({
  regionId,
}: {
  countryCode?: string | null;
  regionId?: string | null;
}) {
  if (regionId?.trim()) {
    return regionId.trim();
  }

  return null;
}

export class AlgoliaBrowseService {
  private client: SearchClient;
  private browseIndexBaseName: string;
  private resolveMarketKey: BrowseMarketKeyResolver;

  constructor(
    appId?: string,
    apiKey?: string,
    productIndexName?: string,
    browseIndexName?: string,
    resolveMarketKey: BrowseMarketKeyResolver = defaultResolveMarketKey
  ) {
    if (!appId || !apiKey) {
      throw new Error(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY.'
      );
    }

    if (!browseIndexName && !productIndexName) {
      throw new Error(
        'Missing Algolia browse index configuration. Set ALGOLIA_PRODUCT_BROWSE_INDEX_NAME or ALGOLIA_PRODUCT_INDEX_NAME.'
      );
    }

    this.client = algoliasearch(appId, apiKey);
    this.browseIndexBaseName = browseIndexName ?? `${productIndexName}_browse`;
    this.resolveMarketKey = resolveMarketKey;
  }

  async browse(params: BrowseProductsArgs): Promise<BrowseProductsResult> {
    const marketKey = await this.resolveMarketKey({
      countryCode: params.countryCode,
      regionId: params.regionId,
    });

    if (!marketKey) {
      throw new Error(
        'Unable to resolve market identifier. Provide regionId or a countryCode mapped to a region.'
      );
    }

    const sort = params.sort ?? 'LATEST';
    const indexName = this.getBrowseIndexName(marketKey, sort);

    try {
      const response = await this.client.searchSingleIndex<AlgoliaBrowseHit>({
        indexName,
        searchParams: {
          query: '',
          hitsPerPage: params.hitsPerPage ?? 20,
          page: params.page ?? 0,
          ...(params.filters && { filters: params.filters }),
          ...(params.facets && { facets: params.facets }),
          attributesToRetrieve: BROWSE_ATTRIBUTES_TO_RETRIEVE,
        },
      });

      return {
        total: response?.nbHits ?? 0,
        page: response?.page ?? 0,
        totalPages: response?.nbPages ?? 0,
        hitsPerPage: response?.hitsPerPage ?? 20,
        params: response?.params,
        facets: response?.facets ?? null,
        items: response?.hits.map((hit) => ({
          id: hit.id,
          title: hit.title,
          description: hit.description,
          thumbnail: hit.thumbnail,
          handle: hit.handle,
          collectionId: hit.collection_id ?? null,
          collectionHandle: hit.collection_handle ?? null,
          categoryIds: hit.category_ids ?? [],
          categoryHandles: hit.category_handles ?? [],
          isSellable: Boolean(hit.is_sellable),
          priceAmount: hit.price_amount ?? null,
          originalPriceAmount: hit.original_price_amount ?? null,
          currencyCode: hit.currency_code ?? null,
          displayPrice: hit.display_price ?? null,
          displayOriginalPrice: hit.display_original_price ?? null,
        })),
      };
    } catch (error) {
      console.error('Algolia browse error:', error);
      throw new Error(
        `Failed to browse Algolia: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  getBrowseIndexName(marketKey: string, sort: BrowseProductsSort = 'LATEST') {
    const suffix = BROWSE_REPLICA_SUFFIX[sort];
    return `${this.browseIndexBaseName}_${sanitizeMarketKey(marketKey)}${suffix}`;
  }
}
