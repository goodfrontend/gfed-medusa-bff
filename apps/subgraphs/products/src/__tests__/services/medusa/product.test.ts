import Medusa from '@medusajs/js-sdk';
import {
  emptyProductsHandler,
  internalServerErrorHandler,
  invalidProductDataHandler,
  largeDataSetsHandler,
  networkTimeoutErrorHandler,
  productNotFoundHandler,
  publishableKeyRequiredHandler,
  rateLimitExceededErrorHandler,
  rateLimitExceededProductErrorHandler,
  unauthorizedAccessHandler,
} from '@mocks/msw/handlers/product';
import { server } from '@mocks/msw/node';
import { createMockProduct, createMockProducts } from '@mocks/products';
import { ProductService } from '@services/medusa/product';

const medusaWithKey = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

const medusaWithoutKey = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
});

describe('ProductService', () => {
  let productService: ProductService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    productService = new ProductService(medusaWithKey);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize correctly with and without publishable key', () => {
      const serviceWithKey = new ProductService(medusaWithKey);
      const serviceWithoutKey = new ProductService(medusaWithoutKey);

      expect(serviceWithKey).toBeInstanceOf(ProductService);
      expect(serviceWithoutKey).toBeInstanceOf(ProductService);
    });
  });

  describe('getProducts', () => {
    it('should handle successful response', async () => {
      const mockProducts = createMockProducts(5);

      const result = await productService.getProducts();

      expect(result.products).toEqual(mockProducts);
      expect(result.products).toHaveLength(5);
      expect(result.count).toBe(5);
    });

    it('should handle empty response', async () => {
      server.use(emptyProductsHandler);

      const result = await productService.getProducts();

      expect(result.products).toEqual([]);
      expect(result.products).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should throw GraphQL errors for different scenarios', async () => {
      const errorScenarios = [
        {
          error: new Error('Network timeout'),
          expectedError: 'ServiceUnavailableError',
          handler: networkTimeoutErrorHandler,
        },
        {
          error: new Error('Internal server error'),
          expectedError: 'MedusaServiceError',
          handler: internalServerErrorHandler,
        },
        {
          error: new Error('Rate limit exceeded'),
          expectedError: 'MedusaServiceError',
          handler: rateLimitExceededErrorHandler,
        },
      ];

      for (const scenario of errorScenarios) {
        server.use(scenario.handler);

        await expect(productService.getProducts()).rejects.toThrow();
      }
    });

    it('should handle invalid data', async () => {
      server.use(invalidProductDataHandler);

      const result = await productService.getProducts();

      expect(result.products).toHaveLength(4);
      expect(result.products[1]).toBeNull();
      expect(result.products[2]).toBeNull();
    });

    it('should handle large datasets', async () => {
      server.use(largeDataSetsHandler);

      const result = await productService.getProducts();
      expect(result.products).toHaveLength(1000);
      expect(result.count).toBe(1000);
    });
  });

  describe('getProduct', () => {
    it('should handle successful retrieval of a product', async () => {
      const mockProduct = createMockProduct();

      const result = await productService.getProduct('prod_1');

      expect(result).toEqual(mockProduct);
      expect(result?.variants).toHaveLength(1);
    });

    it('should throw GraphQL errors for different scenarios', async () => {
      const errorScenarios = [
        {
          error: new Error(`Product with id: nonexistent was not found`),
          id: 'nonexistent',
          handler: productNotFoundHandler,
        },
        {
          error: new Error(
            'Publishable API key required in the request header: x-publishable-api-key. You can manage your keys in settings in the dashboard.'
          ),
          id: 'prod_1',
          handler: publishableKeyRequiredHandler,
        },
        {
          error: new Error('Unauthorized'),
          id: 'prod_1',
          handler: unauthorizedAccessHandler,
        },
        {
          error: new Error('Rate limit exceeded'),
          id: 'prod_1',
          handler: rateLimitExceededProductErrorHandler,
        },
      ];

      for (const scenario of errorScenarios) {
        server.use(scenario.handler);

        await expect(
          productService.getProduct(scenario.id, {})
        ).rejects.toThrow();

        jest.clearAllMocks();
      }
    });
  });

  describe('performance and monitoring', () => {
    it('should handle concurrent requests and multiple calls without caching', async () => {
      await productService.getProduct('prod_1');
      await productService.getProduct('prod_1');
      await productService.getProduct('prod_2');

      const mockProducts = createMockProducts(5);

      const promises = Array.from({ length: 5 }, () =>
        productService.getProducts()
      );
      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.products).toEqual(mockProducts);
      });
    });
  });
});
