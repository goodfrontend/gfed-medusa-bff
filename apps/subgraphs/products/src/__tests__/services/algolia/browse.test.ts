import { HttpResponse, http } from 'msw';

import { server } from '@mocks/msw/node';
import {
  createMockAlgoliaBrowseHits,
  createMockAlgoliaResponse,
} from '@mocks/search';
import { AlgoliaBrowseService } from '@services/algolia/browse';

function buildAlgoliaQueryEndpoint(indexName: string) {
  return `https://${process.env.ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${indexName}/query`;
}

describe('AlgoliaBrowseService', () => {
  let browseService: AlgoliaBrowseService;
  let consoleSpy: jest.SpyInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    process.env = { ...originalEnv };

    browseService = new AlgoliaBrowseService(
      process.env.ALGOLIA_APP_ID,
      process.env.ALGOLIA_API_KEY,
      process.env.ALGOLIA_PRODUCT_INDEX_NAME,
      'products_browse'
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize correctly with valid credentials', () => {
      expect(browseService).toBeInstanceOf(AlgoliaBrowseService);
    });

    it('should throw error when missing credentials', () => {
      expect(
        () =>
          new AlgoliaBrowseService(
            undefined,
            undefined,
            process.env.ALGOLIA_PRODUCT_INDEX_NAME,
            'products_browse'
          )
      ).toThrow(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY'
      );
    });

    it('should throw error when missing browse and product index names', () => {
      expect(
        () =>
          new AlgoliaBrowseService(
            process.env.ALGOLIA_APP_ID,
            process.env.ALGOLIA_API_KEY,
            undefined,
            undefined
          )
      ).toThrow(
        'Missing Algolia browse index configuration. Set ALGOLIA_PRODUCT_BROWSE_INDEX_NAME or ALGOLIA_PRODUCT_INDEX_NAME.'
      );
    });
  });

  describe('getBrowseIndexName', () => {
    it('should resolve the latest index from the primary browse index', () => {
      expect(browseService.getBrowseIndexName('reg_123')).toBe(
        'products_browse_reg_123'
      );
    });

    it('should resolve the correct price replica index', () => {
      expect(browseService.getBrowseIndexName('reg_123', 'PRICE_ASC')).toBe(
        'products_browse_reg_123_price_asc'
      );
      expect(browseService.getBrowseIndexName('reg_123', 'PRICE_DESC')).toBe(
        'products_browse_reg_123_price_desc'
      );
    });
  });

  describe('browse', () => {
    it('should browse /store requests from the latest primary index', async () => {
      const endpoint = buildAlgoliaQueryEndpoint('products_browse_reg_123');

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(3))
          )
        )
      );

      const result = await browseService.browse({
        regionId: 'reg_123',
        sort: 'LATEST',
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0].handle).toBe('test-product-1');
    });

    it('should browse /categories requests and map Algolia hits to PLP items', async () => {
      const endpoint = buildAlgoliaQueryEndpoint('products_browse_reg_123');

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(2), {
              facets: {
                category_handles: {
                  rings: 2,
                },
              },
            })
          )
        )
      );

      const result = await browseService.browse({
        regionId: 'reg_123',
        hitsPerPage: 24,
        page: 1,
        filters: 'category_handles:rings',
        facets: ['category_handles'],
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.items).toEqual([
        {
          id: 'prod_1',
          title: 'Test Product 1',
          description: 'A test product description',
          thumbnail: 'https://example.com/thumbnail.jpg',
          handle: 'test-product-1',
          collectionId: 'pcol_1',
          collectionHandle: 'featured-products',
          categoryIds: ['pcat_1'],
          categoryHandles: ['rings'],
          isSellable: true,
          priceAmount: 129.99,
          originalPriceAmount: 159.99,
          currencyCode: 'usd',
          displayPrice: '$129.99',
          displayOriginalPrice: '$159.99',
        },
        {
          id: 'prod_2',
          title: 'Test Product 2',
          description: 'A test product description',
          thumbnail: 'https://example.com/thumbnail.jpg',
          handle: 'test-product-2',
          collectionId: 'pcol_1',
          collectionHandle: 'featured-products',
          categoryIds: ['pcat_1'],
          categoryHandles: ['rings'],
          isSellable: true,
          priceAmount: 129.99,
          originalPriceAmount: 159.99,
          currencyCode: 'usd',
          displayPrice: '$129.99',
          displayOriginalPrice: '$159.99',
        },
      ]);
      expect(result.facets).toEqual({
        category_handles: {
          rings: 2,
        },
      });
    });

    it('should browse /collections requests with collection filters', async () => {
      const endpoint = buildAlgoliaQueryEndpoint('products_browse_reg_123');

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(1), {
              facets: {
                collection_handle: {
                  'featured-products': 1,
                },
              },
            })
          )
        )
      );

      const result = await browseService.browse({
        regionId: 'reg_123',
        filters: 'collection_handle:featured-products',
        facets: ['collection_handle'],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].collectionHandle).toBe('featured-products');
      expect(result.facets).toEqual({
        collection_handle: {
          'featured-products': 1,
        },
      });
    });

    it('should use the correct price replica for sorted browse requests', async () => {
      const endpoint = buildAlgoliaQueryEndpoint(
        'products_browse_reg_123_price_asc'
      );

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(1))
          )
        )
      );

      const result = await browseService.browse({
        regionId: 'reg_123',
        sort: 'PRICE_ASC',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].handle).toBe('test-product-1');
    });

    it('should support countryCode through a custom market-key resolver', async () => {
      const service = new AlgoliaBrowseService(
        process.env.ALGOLIA_APP_ID,
        process.env.ALGOLIA_API_KEY,
        process.env.ALGOLIA_PRODUCT_INDEX_NAME,
        'products_browse',
        async ({ countryCode }) => {
          if (countryCode === 'us') return 'reg_123';
          return null;
        }
      );
      const endpoint = buildAlgoliaQueryEndpoint(
        'products_browse_reg_123_price_desc'
      );

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(1))
          )
        )
      );

      const result = await service.browse({
        countryCode: 'us',
        sort: 'PRICE_DESC',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should preserve Algolia pagination metadata for PLP pagination', async () => {
      const endpoint = buildAlgoliaQueryEndpoint('products_browse_reg_123');

      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            createMockAlgoliaResponse(createMockAlgoliaBrowseHits(2), {
              page: 2,
              hitsPerPage: 12,
              nbPages: 5,
              nbHits: 50,
            })
          )
        )
      );

      const result = await browseService.browse({
        regionId: 'reg_123',
        page: 2,
        hitsPerPage: 12,
      });

      expect(result.page).toBe(2);
      expect(result.hitsPerPage).toBe(12);
      expect(result.totalPages).toBe(5);
      expect(result.total).toBe(50);
    });

    it('should throw when no market identifier is provided', async () => {
      await expect(
        browseService.browse({
          sort: 'LATEST',
        })
      ).rejects.toThrow(
        'Unable to resolve market identifier. Provide regionId or a countryCode mapped to a region.'
      );
    });
  });
});
