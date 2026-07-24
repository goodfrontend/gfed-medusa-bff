import {
  type AdkAgentResponse,
  validateContentIds,
} from '../services/personalization/adk-client';
import {
  deduplicateComponents,
  enrichComponents,
  trimProducts,
} from '../resolvers/adk-personalization/index';
import type { CategoryOption } from '../services/medusa/category-products';

describe('deduplicateComponents', () => {
  it('removes duplicate HeroBanner with same contentId, keeping first', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: {},
        reasoning: 'first',
        score: 0.9,
      },
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 2,
        propsOverrides: {},
        reasoning: 'second',
        score: 0.8,
      },
    ];
    const result = deduplicateComponents(components);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasoning).toBe('first');
  });

  it('keeps HeroBanners with different contentIds', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: {},
        reasoning: 'first',
        score: 0.9,
      },
      {
        component: 'HeroBanner',
        contentId: 'banner-2',
        priority: 2,
        propsOverrides: {},
        reasoning: 'second',
        score: 0.8,
      },
    ];
    const result = deduplicateComponents(components);
    expect(result).toHaveLength(2);
  });

  it('removes duplicate FeaturedCategoryRail with same handle', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'first',
        score: 0.9,
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 2,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'second',
        score: 0.8,
      },
    ];
    const result = deduplicateComponents(components);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasoning).toBe('first');
  });

  it('keeps FeaturedCategoryRails with different handles', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'first',
        score: 0.9,
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 2,
        propsOverrides: { handle: 'women-shoes' },
        reasoning: 'second',
        score: 0.8,
      },
    ];
    const result = deduplicateComponents(components);
    expect(result).toHaveLength(2);
  });

  it('handles FeaturedCategoryRail with null handle gracefully', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: null },
        reasoning: 'first',
        score: 0.9,
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 2,
        propsOverrides: { handle: null },
        reasoning: 'second',
        score: 0.8,
      },
    ];
    const result = deduplicateComponents(components as AdkAgentResponse['components']);
    expect(result).toHaveLength(1);
  });

  it('preserves components when no duplicates exist', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: {},
        reasoning: 'top banner',
        score: 0.9,
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 2,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'shoes rail',
        score: 0.8,
      },
      {
        component: 'PersonalizedBanner',
        contentId: 'promo-1',
        priority: 3,
        propsOverrides: {},
        reasoning: 'promo',
        score: 0.7,
      },
    ];
    const result = deduplicateComponents(components);
    expect(result).toHaveLength(3);
  });
});

describe('trimProducts', () => {
  it('keeps only id, title, handle, thumbnail from each product', () => {
    const products = [
      {
        id: 'prod-1',
        title: 'Running Shoes',
        handle: 'running-shoes',
        thumbnail: 'https://example.com/img.jpg',
        price: 99.99,
        currencyCode: 'USD',
        description: 'Great running shoes for all terrains',
        __category: 'men-shoes',
        extraField: 'should-be-removed',
      },
    ];
    const result = trimProducts(products as Array<Record<string, unknown>>);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'prod-1',
      title: 'Running Shoes',
      handle: 'running-shoes',
      thumbnail: 'https://example.com/img.jpg',
    });
  });

  it('preserves id, title, handle, thumbnail even if some are missing', () => {
    const products = [
      {
        id: 'prod-1',
        title: 'Running Shoes',
        handle: 'running-shoes',
        price: 99.99,
        description: 'desc',
      },
    ];
    const result = trimProducts(products as Array<Record<string, unknown>>);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'prod-1',
      title: 'Running Shoes',
      handle: 'running-shoes',
    });
    // thumbnail was missing, should not appear
    expect(result[0]!.thumbnail).toBeUndefined();
  });

  it('handles empty array', () => {
    const result = trimProducts([]);
    expect(result).toEqual([]);
  });
});

describe('validateContentIds', () => {
  it('nullifies contentIds that do not exist in availableContent', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'non-existent',
        priority: 1,
        propsOverrides: {},
        reasoning: 'test',
        score: 0.5,
      },
    ];
    const availableContent = [{ _id: 'real-id-1' }, { _id: 'real-id-2' }];

    validateContentIds(components, availableContent as Array<Record<string, unknown>>);

    expect(components[0]!.contentId).toBeNull();
  });

  it('keeps contentIds that exist in availableContent', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'real-id-1',
        priority: 1,
        propsOverrides: {},
        reasoning: 'test',
        score: 0.5,
      },
    ];
    const availableContent = [{ _id: 'real-id-1' }, { _id: 'real-id-2' }];

    validateContentIds(components, availableContent as Array<Record<string, unknown>>);

    expect(components[0]!.contentId).toBe('real-id-1');
  });

  it('nullifies all contentIds when availableContent is empty', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'any-id',
        priority: 1,
        propsOverrides: {},
        reasoning: 'test',
        score: 0.5,
      },
      {
        component: 'PersonalizedBanner',
        contentId: 'another-id',
        priority: 2,
        propsOverrides: {},
        reasoning: 'test2',
        score: 0.4,
      },
    ];

    validateContentIds(components, []);

    expect(components[0]!.contentId).toBeNull();
    expect(components[1]!.contentId).toBeNull();
  });

  it('ignores non-banner components', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: 'whatever',
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'test',
        score: 0.5,
      },
    ];

    validateContentIds(components, []);

    // Non-banner components should be left alone
    expect(components[0]!.contentId).toBe('whatever');
  });

  it('handles already-null contentIds', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: null,
        priority: 1,
        propsOverrides: {},
        reasoning: 'test',
        score: 0.5,
      },
    ];

    validateContentIds(components, []);

    expect(components[0]!.contentId).toBeNull();
  });

  it('skips non-banner components when validating', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: 'some-id',
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'test',
        score: 0.5,
      },
    ];
    // Even with empty availableContent, FeaturedCategoryRail contentId is not nullified
    const availableContent: Array<Record<string, unknown>> = [];

    validateContentIds(components, availableContent);

    expect(components[0]!.contentId).toBe('some-id');
  });
});

describe('enrichComponents FeaturedCategoryRail product trimming', () => {
  const emptyContent: Array<Record<string, unknown>> = [];
  const emptyCategories: CategoryOption[] = [];

  it('trims products in FeaturedCategoryRail to only id, title, handle, thumbnail', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'shoes rail',
        score: 0.9,
      },
    ];
    const products = [
      {
        id: 'prod-1',
        title: 'Running Shoes',
        handle: 'running-shoes',
        thumbnail: 'https://example.com/img.jpg',
        price: 99.99,
        currencyCode: 'USD',
        description: 'Great shoes',
        __category: 'men-shoes',
      },
    ];
    const result = enrichComponents(components, emptyContent, products, emptyCategories);
    expect(result).toHaveLength(1);
    const rail = result[0]!;
    expect(rail.component).toBe('FeaturedCategoryRail');
    const railProducts = rail.propsOverrides?.products as Array<Record<string, unknown>>;
    expect(railProducts).toHaveLength(1);
    expect(railProducts[0]).toEqual({
      id: 'prod-1',
      title: 'Running Shoes',
      handle: 'running-shoes',
      thumbnail: 'https://example.com/img.jpg',
    });
    // price, currencyCode, description, __category should be removed
    expect(railProducts[0]!.price).toBeUndefined();
    expect(railProducts[0]!.currencyCode).toBeUndefined();
    expect(railProducts[0]!.description).toBeUndefined();
    expect(railProducts[0]!.__category).toBeUndefined();
  });

  it('limits FeaturedCategoryRail products to max 4', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'shoes rail',
        score: 0.9,
      },
    ];
    const products = Array.from({ length: 8 }, (_, i) => ({
      id: `prod-${i + 1}`,
      title: `Shoe ${i + 1}`,
      handle: `shoe-${i + 1}`,
      thumbnail: `https://example.com/${i + 1}.jpg`,
      __category: 'men-shoes',
      price: 49.99 + i,
    }));
    const result = enrichComponents(components, emptyContent, products, emptyCategories);
    expect(result).toHaveLength(1);
    const railProducts = result[0]!.propsOverrides?.products as Array<Record<string, unknown>>;
    expect(railProducts).toHaveLength(4);
    expect(railProducts[0]!.id).toBe('prod-1');
    expect(railProducts[3]!.id).toBe('prod-4');
  });

  it('still filters products by __category before trimming', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'men-shoes' },
        reasoning: 'shoes rail',
        score: 0.9,
      },
    ];
    const products = [
      {
        id: 'prod-1',
        title: 'Men Shoe',
        handle: 'men-shoe',
        thumbnail: 'https://example.com/men.jpg',
        __category: 'men-shoes',
        price: 99.99,
      },
      {
        id: 'prod-2',
        title: 'Women Shoe',
        handle: 'women-shoe',
        thumbnail: 'https://example.com/women.jpg',
        __category: 'women-shoes',
        price: 79.99,
      },
    ];
    const result = enrichComponents(components, emptyContent, products, emptyCategories);
    expect(result).toHaveLength(1);
    const railProducts = result[0]!.propsOverrides?.products as Array<Record<string, unknown>>;
    expect(railProducts).toHaveLength(1);
    expect(railProducts[0]!.id).toBe('prod-1');
  });

  it('handles empty products for a category', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 1,
        propsOverrides: { handle: 'unknown-category' },
        reasoning: 'test',
        score: 0.5,
      },
    ];
    const products = [
      {
        id: 'prod-1',
        title: 'Shoe',
        handle: 'shoe',
        thumbnail: 'https://example.com/shoe.jpg',
        __category: 'men-shoes',
      },
    ];
    const result = enrichComponents(components, emptyContent, products, emptyCategories);
    expect(result).toHaveLength(1);
    const railProducts = result[0]!.propsOverrides?.products as Array<Record<string, unknown>>;
    expect(railProducts).toHaveLength(0);
  });
});

describe('enrichComponents reasoning validation', () => {
  const emptyContent: Array<Record<string, unknown>> = [];
  const emptyProducts: Array<Record<string, unknown>> = [];
  const emptyCategories: CategoryOption[] = [];

  it('appends correction note when title has "Men\'s" but reasoning mentions "women\'s"', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: { title: "Men's Collection" },
        reasoning: "perfect for women's casual style",
        score: 0.9,
      },
    ];
    const result = enrichComponents(components, emptyContent, emptyProducts, emptyCategories);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasoning).toBe(
      "perfect for women's casual style (note: component targets Men's Collection)"
    );
  });

  it('appends correction note when title has "Women\'s" but reasoning mentions "men\'s"', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'PersonalizedBanner',
        contentId: 'banner-2',
        priority: 1,
        propsOverrides: { title: "Women's Shoes" },
        reasoning: "perfect for men's active lifestyle",
        score: 0.8,
      },
    ];
    const result = enrichComponents(components, emptyContent, emptyProducts, emptyCategories);
    expect(result).toHaveLength(1);
    expect(result[0]!.reasoning).toBe(
      "perfect for men's active lifestyle (note: component targets Women's Shoes)"
    );
  });

  it('skips components with no title without error', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: {},
        reasoning: 'user has high shoes affinity',
        score: 0.9,
      },
    ];
    const result = enrichComponents(components, emptyContent, emptyProducts, emptyCategories);
    expect(result).toHaveLength(1);
    // Reasoning should be unchanged since there's no title to compare
    expect(result[0]!.reasoning).toBe('user has high shoes affinity');
  });

  it('skips components with no reasoning without error', () => {
    const components: AdkAgentResponse['components'] = [
      {
        component: 'HeroBanner',
        contentId: 'banner-1',
        priority: 1,
        propsOverrides: { title: "Men's Collection" },
        reasoning: '',
        score: 0.9,
      },
    ];
    const result = enrichComponents(components, emptyContent, emptyProducts, emptyCategories);
    expect(result).toHaveLength(1);
    // Should not throw — empty reasoning with mismatch should be left as-is
    expect(result[0]!.reasoning).toBe('');
  });
});
