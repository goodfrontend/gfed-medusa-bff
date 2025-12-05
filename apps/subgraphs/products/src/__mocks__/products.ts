export const createMockMedusaProduct = (overrides = {}) => ({
  id: 'prod_1',
  title: 'Test Product',
  handle: 'test-product',
  description: 'A test product description',
  subtitle: 'Test subtitle',
  is_giftcard: false,
  discountable: true,
  status: 'published' as const,
  external_id: null,
  thumbnail: 'https://example.com/thumbnail.jpg',
  weight: 250,
  length: 10,
  height: 5,
  width: 8,
  origin_country: 'US',
  hs_code: '1234567890',
  mid_code: 'MID123',
  material: 'Cotton',
  collection_id: 'coll_1',
  collection: {
    id: 'coll_1',
    title: 'Collection Title',
    handle: 'Collection Handle',
  },
  type_id: 'type_1',
  type: {
    id: 'type_1',
  },
  tags: [
    {
      id: 'tag_1',
      value: 'eco-friendly',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
      metadata: null,
    },
    {
      id: 'tag_2',
      value: 'cotton',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
      metadata: null,
    },
  ],
  images: [
    {
      id: 'img_1',
      url: 'https://example.com/image1.jpg',
      rank: 0,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'img_2',
      url: 'https://example.com/image2.jpg',
      rank: 1,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
    },
  ],
  options: [
    {
      id: 'opt_1',
      title: 'Size',
      values: [
        { id: 'val_1', value: 'S' },
        { id: 'val_2', value: 'M' },
        { id: 'val_3', value: 'L' },
      ],
    },
  ],
  variants: [
    {
      id: 'var_1',
      title: 'S',
      sku: 'PROD-S',
      barcode: null,
      ean: null,
      upc: null,
      allow_backorder: false,
      manage_inventory: true,
      hs_code: null,
      origin_country: 'US',
      mid_code: null,
      material: 'Cotton',
      weight: 250,
      length: 10,
      height: 5,
      width: 8,
      options: [{ id: 'opt_val_1', option_id: 'opt_1', value: 'S' }],
      inventory_quantity: 10,
      product_id: 'prod_1',
      variant_rank: 0,
      metadata: null,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
    },
  ],
  categories: [
    {
      id: 'cat_1',
      name: 'Clothing',
      description: 'Clothing category',
      handle: 'clothing',
      parent_category_id: null,
      parent_category: null,
      category_children: [],
      rank: 0,
      metadata: null,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      deleted_at: null,
    },
  ],
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-02T00:00:00.000Z',
  deleted_at: null,
  metadata: { brand: 'TestBrand' },
  ...overrides,
});

export const createMockProduct = (overrides = {}) => ({
  id: 'prod_1',
  title: 'Test Product',
  handle: 'test-product',
  description: 'A test product description',
  thumbnail: 'https://example.com/thumbnail.jpg',
  weight: 250,
  length: 10,
  height: 5,
  width: 8,
  originCountry: 'US',
  material: 'Cotton',
  collectionId: 'coll_1',
  type: 'type_1',
  createdAt: '2023-01-01T00:00:00.000Z',
  collection: {
    id: 'coll_1',
    title: 'Collection Title',
    handle: 'Collection Handle',
  },
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
      url: 'https://example.com/image1.jpg',
    },
    {
      id: 'img_2',
      url: 'https://example.com/image2.jpg',
    },
  ],
  options: [
    {
      id: 'opt_1',
      title: 'Size',
      values: [
        { id: 'val_1', value: 'S' },
        { id: 'val_2', value: 'M' },
        { id: 'val_3', value: 'L' },
      ],
    },
  ],
  variants: [
    {
      id: 'var_1',
      sku: 'PROD-S',
      allowBackorder: false,
      manageInventory: true,
      options: [{ id: 'opt_val_1', optionId: 'opt_1', value: 'S' }],
      inventoryQuantity: 10,
    },
  ],
  ...overrides,
});

export const createMockProducts = (count = 3) =>
  Array.from({ length: count }, (_, i) =>
    createMockProduct({
      id: `prod_${i + 1}`,
      title: `Test Product ${i + 1}`,
      handle: `test-product-${i + 1}`,
    })
  );

export const createMockMedusaProducts = (count = 3) =>
  Array.from({ length: count }, (_, i) =>
    createMockMedusaProduct({
      id: `prod_${i + 1}`,
      title: `Test Product ${i + 1}`,
      handle: `test-product-${i + 1}`,
    })
  );
