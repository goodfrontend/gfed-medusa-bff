import { type SearchClient, algoliasearch } from 'algoliasearch';

import {
  QuerySearchProductsArgs,
  SearchProducts,
} from '@graphql/generated/graphql';

import { ATTRIBUTES_TO_RETRIEVE } from '../../constants/algolia';

export interface AlgoliaHit {
  id: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  handle: string;
}

export class AlgoliaSearchService {
  private client: SearchClient;
  private defaultIndex: string;

  constructor(appId?: string, apiKey?: string, index?: string) {
    if (!appId || !apiKey) {
      throw new Error(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY.'
      );
    }
    if (!index) {
      throw new Error(
        'Missing ALGOLIA_PRODUCT_INDEX_NAME environment variable.'
      );
    }

    this.client = algoliasearch(appId, apiKey);
    this.defaultIndex = index;
  }

  async search(params: QuerySearchProductsArgs): Promise<SearchProducts> {
    try {
      const response = await this.client.searchSingleIndex<AlgoliaHit>({
        indexName: params.indexName ?? this.defaultIndex,
        searchParams: {
          query: params.query ?? '',
          hitsPerPage: params.hitsPerPage ?? 20,
          page: params.page ?? 0,
          ...(params.filters && { filters: params.filters }),
          ...(params.facets && { facets: params.facets }),
          attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
        },
      });

      return {
        total: response?.nbHits ?? 0,
        page: response?.page ?? 0,
        totalPages: response?.nbPages ?? 0,
        hitsPerPage: response?.hitsPerPage ?? 20,
        query: response?.query,
        params: response?.params,
        items: response?.hits.map(
          ({ id, title, description, thumbnail, handle }) => ({
            id,
            title,
            description,
            thumbnail,
            handle,
          })
        ),
      };
    } catch (error) {
      console.error('Algolia search error:', error);
      throw new Error(
        `Failed to search Algolia: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
