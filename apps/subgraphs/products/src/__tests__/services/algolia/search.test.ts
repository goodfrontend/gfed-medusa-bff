import {
  customParamHandler,
  emptySearchHandler,
  internalServerErrorHandler,
  invalidCredentialsErrorHandler,
  invalidDataHandler,
  largeDataSetsHandler,
  networkTimeoutErrorHandler,
  rateLimitExceededErrorHandler,
  searchNotFoundErrorHandler,
  unauthorizedErrorHandler,
} from '@mocks/msw/handlers/search';
import { server } from '@mocks/msw/node';
import { createMockAlgoliaHits } from '@mocks/search';
import { AlgoliaSearchService } from '@services/algolia/search';

describe('AlgoliaSearchService', () => {
  let searchService: AlgoliaSearchService;
  let consoleSpy: jest.SpyInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    process.env = { ...originalEnv };

    searchService = new AlgoliaSearchService(
      process.env.ALGOLIA_APP_ID,
      process.env.ALGOLIA_API_KEY,
      process.env.ALGOLIA_PRODUCT_INDEX_NAME
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize correctly with valid credentials', () => {
      expect(searchService).toBeInstanceOf(AlgoliaSearchService);
    });

    it('should throw error when missing credentials', () => {
      expect(
        () =>
          new AlgoliaSearchService(
            undefined,
            undefined,
            process.env.ALGOLIA_PRODUCT_INDEX_NAME
          )
      ).toThrow(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY'
      );
    });

    it('should throw error when missing app ID', () => {
      expect(
        () =>
          new AlgoliaSearchService(
            undefined,
            process.env.ALGOLIA_API_KEY,
            process.env.ALGOLIA_PRODUCT_INDEX_NAME
          )
      ).toThrow(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY'
      );
    });

    it('should throw error when missing API key', () => {
      expect(
        () =>
          new AlgoliaSearchService(
            process.env.ALGOLIA_APP_ID,
            undefined,
            process.env.ALGOLIA_PRODUCT_INDEX_NAME
          )
      ).toThrow(
        'Missing Algolia credentials. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY'
      );
    });

    it('should throw error when missing index name', () => {
      expect(
        () =>
          new AlgoliaSearchService(
            process.env.ALGOLIA_APP_ID,
            process.env.ALGOLIA_API_KEY,
            undefined
          )
      ).toThrow('Missing ALGOLIA_PRODUCT_INDEX_NAME environment variable.');
    });
  });

  describe('search', () => {
    it('should handle successful search response', async () => {
      const mockHits = createMockAlgoliaHits(5);

      const result = await searchService.search({
        query: 'test',
        hitsPerPage: 20,
        page: 0,
      });

      expect(result.items).toHaveLength(5);
      expect(result.items).toEqual(mockHits);
      expect(result.total).toBe(5);
      expect(result.page).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.hitsPerPage).toBe(20);
    });

    it('should handle empty search response', async () => {
      server.use(emptySearchHandler);

      const result = await searchService.search({
        query: 'nonexistent',
        hitsPerPage: 20,
        page: 0,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle search with default parameters', async () => {
      const result = await searchService.search({
        query: 'test',
      });

      expect(result.items).toHaveLength(5);
      expect(result.hitsPerPage).toBe(20);
      expect(result.page).toBe(0);
    });

    it('should handle search with custom parameters', async () => {
      server.use(customParamHandler);

      const result = await searchService.search({
        query: 'test',
        hitsPerPage: 10,
        page: 1,
      });

      expect(result.items).toHaveLength(5);
      expect(result.hitsPerPage).toBe(10);
      expect(result.page).toBe(1);
    });

    it('should throw errors for different scenarios', async () => {
      const errorScenarios = [
        {
          name: 'Network timeout',
          error: new Error('Network timeout'),
          handler: networkTimeoutErrorHandler,
        },
        {
          name: 'Internal server error',
          error: new Error('Internal server error'),
          handler: internalServerErrorHandler,
        },
        {
          name: 'Rate limit exceeded',
          error: new Error('Rate limit exceeded'),
          handler: rateLimitExceededErrorHandler,
        },
        {
          name: 'Unauthorized',
          error: new Error('Unauthorized'),
          handler: unauthorizedErrorHandler,
        },
        {
          name: 'Invalid credentials',
          error: new Error('Invalid credentials'),
          handler: invalidCredentialsErrorHandler,
        },
        {
          name: 'Search not found',
          error: new Error('Search not found'),
          handler: searchNotFoundErrorHandler,
        },
      ];

      for (const scenario of errorScenarios) {
        server.use(scenario.handler);

        await expect(
          searchService.search({
            query: 'test',
          })
        ).rejects.toThrow();
      }
    });

    it('should handle large datasets', async () => {
      server.use(largeDataSetsHandler);

      const result = await searchService.search({
        query: 'test',
      });

      expect(result.items).toHaveLength(1000);
      expect(result.total).toBe(1000);
      expect(result.totalPages).toBe(50);
    });

    it('should handle empty query', async () => {
      const result = await searchService.search({
        query: '',
      });

      expect(result.items).toHaveLength(5);
      expect(result.query).toBe('');
    });

    it('should handle null/undefined values in hits', async () => {
      server.use(invalidDataHandler);

      const result = await searchService.search({
        query: 'test',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'prod_1',
        title: null,
        description: undefined,
        thumbnail: null,
        handle: 'test-product',
      });
    });
  });
});
