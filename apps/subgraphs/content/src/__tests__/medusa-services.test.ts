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
const { fetchCategoryProducts } = require('../services/medusa/category-products');

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
        product_categories: [{ id: 'cat-mens-1', name: "Men's", handle: 'mens' }],
      });

      mockMedusa.store.product.list.mockResolvedValue({
        products: [
          { id: 'prod-1', title: 'Mens Shirt', handle: 'mens-shirt', thumbnail: 'img1.jpg' },
          { id: 'prod-2', title: 'Mens Pants', handle: 'mens-pants', thumbnail: 'img2.jpg' },
          { id: 'prod-3', title: 'Mens Jacket', handle: 'mens-jacket', thumbnail: null },
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
        fields: 'id,title,handle,thumbnail',
      });

      expect(products).toHaveLength(3);
      expect(products[0]).toEqual({
        id: 'prod-1',
        title: 'Mens Shirt',
        handle: 'mens-shirt',
        thumbnail: 'img1.jpg',
      });
      expect(products[2].thumbnail).toBe('');
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
      mockMedusa.store.category.list.mockRejectedValue(new Error('Network error'));

      await expect(fetchCategoryProducts('mens')).rejects.toThrow('Network error');
    });
  });
});
