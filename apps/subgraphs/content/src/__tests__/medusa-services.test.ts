jest.mock('../services/medusa/index', () => {
  const mockMedusa = {
    store: {
      category: {
        list: jest.fn(),
      },
      product: {
        list: jest.fn(),
      },
    },
  };
  return {
    getMedusaClient: jest.fn().mockReturnValue(mockMedusa),
    resetMedusaClient: jest.fn(),
  };
});

const { getMedusaClient } = require('../services/medusa/index');
const {
  fetchCategoryProducts,
  fetchCategoryProductsEnriched,
} = require('../services/medusa/category-products');

describe('Medusa Services', () => {
  let mockMedusa: {
    store: {
      category: { list: jest.Mock };
      product: { list: jest.Mock };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMedusa = getMedusaClient() as ReturnType<typeof getMedusaClient>;
  });

  describe('fetchCategoryProducts', () => {
    it('fetches products for a category by handle', async () => {
      mockMedusa.store.category.list.mockResolvedValue({
        product_categories: [
          { id: 'cat-mens-1', name: "Men's", handle: 'mens' },
        ],
      });

      mockMedusa.store.product.list.mockResolvedValue({
        products: [
          {
            id: 'prod-1',
            title: 'Mens Shirt',
            handle: 'mens-shirt',
            thumbnail: 'img1.jpg',
            variants: [
              {
                calculated_price: {
                  calculated_amount: 29.99,
                  currency_code: 'USD',
                },
              },
            ],
          },
          {
            id: 'prod-2',
            title: 'Mens Pants',
            handle: 'mens-pants',
            thumbnail: 'img2.jpg',
            variants: [
              {
                calculated_price: {
                  calculated_amount: 49.99,
                  currency_code: 'USD',
                },
              },
            ],
          },
          {
            id: 'prod-3',
            title: 'Mens Jacket',
            handle: 'mens-jacket',
            thumbnail: null,
            variants: null,
          },
        ],
        count: 3,
      });

      const products = await fetchCategoryProducts('mens');

      expect(mockMedusa.store.category.list).toHaveBeenCalledWith({
        handle: 'mens',
        limit: 1,
      });
      expect(mockMedusa.store.product.list).toHaveBeenCalledWith({
        category_id: ['cat-mens-1'],
        limit: 3,
        order: '-created_at',
        is_giftcard: false,
        fields: 'id,title,handle,thumbnail,variants.calculated_price',
      });

      expect(products).toHaveLength(3);
      expect(products[0]).toEqual({
        id: 'prod-1',
        title: 'Mens Shirt',
        handle: 'mens-shirt',
        thumbnail: 'img1.jpg',
        price: 29.99,
        currencyCode: 'USD',
      });
      expect(products[2].thumbnail).toBe('');
      expect(products[2].price).toBeUndefined();
      expect(products[2].currencyCode).toBeUndefined();
    });

    it('returns empty array when no category found', async () => {
      mockMedusa.store.category.list.mockResolvedValue({
        product_categories: [],
      });

      const products = await fetchCategoryProducts('nonexistent');

      expect(products).toEqual([]);
      expect(mockMedusa.store.product.list).not.toHaveBeenCalled();
    });

    it('handles API errors gracefully by propagating the error', async () => {
      mockMedusa.store.category.list.mockRejectedValue(
        new Error('Network error')
      );

      await expect(fetchCategoryProducts('mens')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('fetchCategoryProductsEnriched', () => {
    const variantWithPrice = {
      prices: [{ amount: 2999, currency_code: 'usd' }],
    };
    const variantNoPrice = { prices: [] };

    it('fetches up to 8 products with enriched fields', async () => {
      mockMedusa.store.category.list.mockResolvedValue({
        product_categories: [
          { id: 'cat-womens', name: "Women's", handle: 'womens' },
        ],
      });

      const mockProducts = Array.from({ length: 8 }, (_, i) => ({
        id: `prod-${i + 1}`,
        title: `Product ${i + 1}`,
        handle: `product-${i + 1}`,
        thumbnail: `img${i + 1}.jpg`,
        description: `Description for product ${i + 1}`,
        variants: [variantWithPrice],
      }));

      mockMedusa.store.product.list.mockResolvedValue({
        products: mockProducts,
        count: 8,
      });

      const products = await fetchCategoryProductsEnriched('womens');

      expect(mockMedusa.store.product.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 8,
          fields: expect.stringContaining('description'),
        })
      );
      expect(mockMedusa.store.product.list).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.stringContaining(
            'variants.prices.amount,variants.prices.currency_code'
          ),
        })
      );

      expect(products).toHaveLength(8);
      for (const product of products) {
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('currencyCode');
        expect(product).toHaveProperty('description');
      }
      expect(products[0]).toEqual({
        id: 'prod-1',
        title: 'Product 1',
        handle: 'product-1',
        thumbnail: 'img1.jpg',
        price: 2999,
        currencyCode: 'usd',
        description: 'Description for product 1',
      });
    });

    it('returns empty array when no category found', async () => {
      mockMedusa.store.category.list.mockResolvedValue({
        product_categories: [],
      });

      const products = await fetchCategoryProductsEnriched('nonexistent');

      expect(products).toEqual([]);
      expect(mockMedusa.store.product.list).not.toHaveBeenCalled();
    });

    it('handles missing price gracefully', async () => {
      mockMedusa.store.category.list.mockResolvedValue({
        product_categories: [
          { id: 'cat-no-price', name: 'No Price', handle: 'no-price' },
        ],
      });

      mockMedusa.store.product.list.mockResolvedValue({
        products: [
          {
            id: 'prod-no-variant',
            title: 'No Variant',
            handle: 'no-variant',
            thumbnail: 'img.jpg',
            description: 'No variant product',
            variants: [],
          },
        ],
        count: 1,
      });

      const products = await fetchCategoryProductsEnriched('no-price');

      expect(products).toHaveLength(1);
      expect(products[0].price).toBeNull();
      expect(products[0].currencyCode).toBeNull();
      expect(products[0].description).toBe('No variant product');
    });

    it('handles API errors gracefully by propagating the error', async () => {
      mockMedusa.store.category.list.mockRejectedValue(
        new Error('Medusa API error')
      );

      await expect(fetchCategoryProductsEnriched('mens')).rejects.toThrow(
        'Medusa API error'
      );
    });
  });
});
