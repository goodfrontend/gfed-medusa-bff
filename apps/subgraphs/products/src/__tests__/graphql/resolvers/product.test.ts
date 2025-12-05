import { productResolvers } from '@graphql/resolvers/product';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import { mockMedusa } from '@mocks/medusa';
import { createMockProduct, createMockProducts } from '@mocks/products';
import { AlgoliaSearchService } from '@services/algolia/search';
import { CategoryService } from '@services/medusa/category';
import { CollectionService } from '@services/medusa/collection';
import { ProductService } from '@services/medusa/product';

describe('Product Resolvers', () => {
  let mockProductService: jest.Mocked<ProductService>;
  let mockCategoryService: jest.Mocked<CategoryService>;
  let mockCollectionService: jest.Mocked<CollectionService>;
  let mockAlgoliaSearchService: jest.Mocked<AlgoliaSearchService>;
  let mockContext: GraphQLContext;

  beforeEach(() => {
    mockProductService = {
      getProducts: jest.fn(),
      getProduct: jest.fn(),
    } as unknown as jest.Mocked<ProductService>;

    mockCategoryService = {
      getCategories: jest.fn(),
      getCategory: jest.fn(),
    } as unknown as jest.Mocked<CategoryService>;

    mockCollectionService = {
      getCollections: jest.fn(),
      getCollection: jest.fn(),
    } as unknown as jest.Mocked<CollectionService>;

    mockAlgoliaSearchService = {
      search: jest.fn(),
    } as unknown as jest.Mocked<AlgoliaSearchService>;

    mockContext = {
      medusa: mockMedusa as unknown as Medusa,
      productService: mockProductService,
      categoryService: mockCategoryService,
      collectionService: mockCollectionService,
      algoliaSearchService: mockAlgoliaSearchService,
    } as unknown as GraphQLContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.products', () => {
    it('should handle successful responses, empty results, and data integrity', async () => {
      const mockProducts = createMockProducts(3);
      const mockResponse = {
        products: mockProducts,
        count: 3,
        limit: 20,
        offset: 0,
      };
      mockProductService.getProducts.mockResolvedValue(mockResponse);

      let result = await productResolvers.Query.products(
        {},
        { limit: 20, offset: 0 },
        mockContext
      );

      expect(mockProductService.getProducts).toHaveBeenCalledTimes(1);
      expect(mockProductService.getProducts).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual(mockResponse);
      expect(result.products).toHaveLength(3);

      const emptyResponse = {
        products: [],
        count: 0,
        limit: 20,
        offset: 0,
      };
      mockProductService.getProducts.mockResolvedValue(emptyResponse);
      result = await productResolvers.Query.products(
        {},
        { limit: 20, offset: 0 },
        mockContext
      );
      expect(result).toEqual(emptyResponse);

      const originalProducts = JSON.parse(JSON.stringify(mockResponse));
      mockProductService.getProducts.mockResolvedValue(mockResponse);
      result = await productResolvers.Query.products(
        {},
        { limit: 20, offset: 0 },
        mockContext
      );
      expect(result).toEqual(originalProducts);

      const largeProductSet = createMockProducts(1000);
      const largeResponse = {
        products: largeProductSet,
        count: 1000,
        limit: 20,
        offset: 0,
      };
      mockProductService.getProducts.mockResolvedValue(largeResponse);
      result = await productResolvers.Query.products(
        {},
        { limit: 20, offset: 0 },
        mockContext
      );
      expect(result.products).toHaveLength(1000);
    });

    it('should handle all error scenarios', async () => {
      const errorScenarios = [
        'Database connection failed',
        'Request timeout',
        'Service temporarily unavailable',
      ];

      for (const errorMessage of errorScenarios) {
        const error = new Error(errorMessage);
        mockProductService.getProducts.mockRejectedValue(error);

        await expect(
          productResolvers.Query.products(
            {},
            { limit: 20, offset: 0 },
            mockContext
          )
        ).rejects.toThrow(errorMessage);

        expect(mockProductService.getProducts).toHaveBeenCalledTimes(1);
        jest.clearAllMocks();
      }
    });
  });

  describe('Query.product', () => {
    it('should handle successful retrieval and complex products', async () => {
      const mockProduct = createMockProduct({
        id: 'prod_123',
        title: 'Specific Product',
      });
      mockProductService.getProduct.mockResolvedValue(mockProduct);

      let result = await productResolvers.Query.product(
        {},
        { id: 'prod_123' },
        mockContext
      );

      expect(mockProductService.getProduct).toHaveBeenCalledWith('prod_123', {
        id: 'prod_123',
      });
      expect(mockProductService.getProduct).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProduct);
      expect(result?.id).toBe('prod_123');

      const complexMockProduct = createMockProduct({
        id: 'prod_complex',
        title: 'Complex Product',
        description: 'A complex product with many properties',
        weight: 250,
        material: 'Organic Cotton',
        tags: [
          {
            id: 'tag_1',
          },
          {
            id: 'tag_2',
          },
        ],
        images: [
          {
            id: 'img_1',
            url: 'image1.jpg',
          },
          {
            id: 'img_2',
            url: 'image2.jpg',
          },
        ],
      });

      mockProductService.getProduct.mockResolvedValue(complexMockProduct);
      result = await productResolvers.Query.product(
        {},
        { id: 'prod_complex' },
        mockContext
      );

      expect(result).toEqual(complexMockProduct);
      expect(result?.weight).toBe(250);
      expect(result?.material).toBe('Organic Cotton');
      expect(result?.tags).toEqual([
        {
          id: 'tag_1',
        },
        {
          id: 'tag_2',
        },
      ]);

      mockProductService.getProduct.mockResolvedValue(null);
      result = await productResolvers.Query.product(
        {},
        { id: 'nonexistent' },
        mockContext
      );
      expect(result).toBeNull();
    });
  });

  describe('Query.searchProducts', () => {
    it('should handle successful search with basic query', async () => {
      const mockSearchResponse = {
        total: 5,
        page: 0,
        totalPages: 1,
        hitsPerPage: 20,
        query: 'shirt',
        params: 'query=shirt&hitsPerPage=20&page=0',
        items: [
          {
            id: 'prod_1',
            title: 'Cotton Shirt',
            description: 'Comfortable cotton shirt',
            handle: 'cotton-shirt',
            thumbnail: 'https://example.com/shirt.jpg',
          },
          {
            id: 'prod_2',
            title: 'Denim Shirt',
            description: 'Classic denim shirt',
            handle: 'denim-shirt',
            thumbnail: 'https://example.com/denim-shirt.jpg',
          },
        ],
      };

      mockAlgoliaSearchService.search.mockResolvedValue(mockSearchResponse);

      const result = await productResolvers.Query.searchProducts(
        {},
        { query: 'shirt' },
        mockContext
      );

      expect(mockAlgoliaSearchService.search).toHaveBeenCalledTimes(1);
      expect(mockAlgoliaSearchService.search).toHaveBeenCalledWith({
        query: 'shirt',
      });
      expect(result).toEqual(mockSearchResponse);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should handle search with all parameters', async () => {
      const mockSearchResponse = {
        total: 3,
        page: 1,
        totalPages: 2,
        hitsPerPage: 10,
        query: 'jacket',
        params:
          'query=jacket&hitsPerPage=10&page=1&filters=category:clothing&facets=brand',
        items: [
          {
            id: 'prod_3',
            title: 'Winter Jacket',
            description: 'Warm winter jacket',
            handle: 'winter-jacket',
            thumbnail: 'https://example.com/jacket.jpg',
          },
        ],
      };

      mockAlgoliaSearchService.search.mockResolvedValue(mockSearchResponse);

      const searchArgs = {
        query: 'jacket',
        indexName: 'products_index',
        hitsPerPage: 10,
        page: 1,
        filters: 'category:clothing',
        facets: ['brand'],
      };

      const result = await productResolvers.Query.searchProducts(
        {},
        searchArgs,
        mockContext
      );

      expect(mockAlgoliaSearchService.search).toHaveBeenCalledTimes(1);
      expect(mockAlgoliaSearchService.search).toHaveBeenCalledWith(searchArgs);
      expect(result).toEqual(mockSearchResponse);
      expect(result.page).toBe(1);
      expect(result.hitsPerPage).toBe(10);
    });

    it('should handle empty search results', async () => {
      const mockEmptyResponse = {
        total: 0,
        page: 0,
        totalPages: 0,
        hitsPerPage: 20,
        query: 'nonexistent',
        params: 'query=nonexistent&hitsPerPage=20&page=0',
        items: [],
      };

      mockAlgoliaSearchService.search.mockResolvedValue(mockEmptyResponse);

      const result = await productResolvers.Query.searchProducts(
        {},
        { query: 'nonexistent' },
        mockContext
      );

      expect(mockAlgoliaSearchService.search).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockEmptyResponse);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle search with default values when parameters are not provided', async () => {
      const mockSearchResponse = {
        total: 1,
        page: 0,
        totalPages: 1,
        hitsPerPage: 20,
        query: '',
        params: 'query=&hitsPerPage=20&page=0',
        items: [
          {
            id: 'prod_4',
            title: 'Default Product',
            description: 'Product with default search',
            handle: 'default-product',
            thumbnail: 'https://example.com/default.jpg',
          },
        ],
      };

      mockAlgoliaSearchService.search.mockResolvedValue(mockSearchResponse);

      const result = await productResolvers.Query.searchProducts(
        {},
        {},
        mockContext
      );

      expect(mockAlgoliaSearchService.search).toHaveBeenCalledTimes(1);
      expect(mockAlgoliaSearchService.search).toHaveBeenCalledWith({});
      expect(result).toEqual(mockSearchResponse);
    });

    it('should handle search with filters and facets', async () => {
      const mockFilteredResponse = {
        total: 2,
        page: 0,
        totalPages: 1,
        hitsPerPage: 20,
        query: 'shirt',
        params:
          'query=shirt&filters=category:clothing AND price:1000 TO 5000&facets=brand,color',
        items: [
          {
            id: 'prod_filtered_1',
            title: 'Filtered Shirt 1',
            description: 'Shirt matching filters',
            handle: 'filtered-shirt-1',
            thumbnail: 'https://example.com/filtered1.jpg',
          },
          {
            id: 'prod_filtered_2',
            title: 'Filtered Shirt 2',
            description: 'Another filtered shirt',
            handle: 'filtered-shirt-2',
            thumbnail: 'https://example.com/filtered2.jpg',
          },
        ],
      };

      mockAlgoliaSearchService.search.mockResolvedValue(mockFilteredResponse);

      const result = await productResolvers.Query.searchProducts(
        {},
        {
          query: 'shirt',
          filters: 'category:clothing AND price:1000 TO 5000',
          facets: ['brand', 'color'],
        },
        mockContext
      );

      expect(mockAlgoliaSearchService.search).toHaveBeenCalledWith({
        query: 'shirt',
        filters: 'category:clothing AND price:1000 TO 5000',
        facets: ['brand', 'color'],
      });
      expect(result).toEqual(mockFilteredResponse);
      expect(result.items).toHaveLength(2);
    });

    it('should handle all error scenarios', async () => {
      const errorScenarios = [
        'Algolia API connection failed',
        'Invalid search parameters',
        'Search timeout',
        'Index not found',
        'Rate limit exceeded',
      ];

      for (const errorMessage of errorScenarios) {
        const error = new Error(errorMessage);
        mockAlgoliaSearchService.search.mockRejectedValue(error);

        await expect(
          productResolvers.Query.searchProducts(
            {},
            { query: 'test' },
            mockContext
          )
        ).rejects.toThrow(errorMessage);

        expect(mockAlgoliaSearchService.search).toHaveBeenCalledTimes(1);
        jest.clearAllMocks();
      }
    });
  });
});
