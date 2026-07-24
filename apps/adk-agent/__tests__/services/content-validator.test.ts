import { describe, it, expect } from 'vitest';

import { validateContentIds } from '../../src/services/content-validator';
import type { DecisionComponent, AvailableContent } from '../../src/types';

describe('validateContentIds', () => {
  const validContent: AvailableContent[] = [
    { _id: 'content-1', _type: 'heroBanner', title: 'Hero 1' } as AvailableContent,
    { _id: 'content-2', _type: 'homeBanner', title: 'Banner 1' } as AvailableContent,
    { _id: 'content-3', _type: 'heroBanner', title: 'Hero 2' } as AvailableContent,
  ];

  describe('FeaturedCategoryRail', () => {
    it('sets contentId to null for FeaturedCategoryRail', () => {
      const components: DecisionComponent[] = [
        {
          component: 'FeaturedCategoryRail',
          contentId: 'invalid-id',
          propsOverrides: { handle: 'mens' },
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBeNull();
      expect(result.replacedIds).toHaveLength(0);
    });

    it('keeps FeaturedCategoryRail even without availableContent', () => {
      const components: DecisionComponent[] = [
        {
          component: 'FeaturedCategoryRail',
          contentId: null,
          propsOverrides: { handle: 'mens' },
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, []);

      expect(result.components).toHaveLength(1);
      expect(result.components[0].component).toBe('FeaturedCategoryRail');
    });
  });

  describe('HeroBanner', () => {
    it('keeps valid contentId', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: 'content-1',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-1');
      expect(result.replacedIds).toHaveLength(0);
    });

    it('replaces invalid contentId with valid heroBanner', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: 'nonexistent',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-1');
      expect(result.replacedIds).toContain('nonexistent');
    });

    it('replaces null contentId with valid heroBanner', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: null,
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-1');
    });

    it('removes component when no valid content available', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: 'nonexistent',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, []);

      expect(result.components).toHaveLength(0);
      expect(result.removedComponents).toContain('HeroBanner');
    });
  });

  describe('PersonalizedBanner', () => {
    it('keeps valid contentId', () => {
      const components: DecisionComponent[] = [
        {
          component: 'PersonalizedBanner',
          contentId: 'content-2',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-2');
    });

    it('replaces invalid contentId with valid homeBanner', () => {
      const components: DecisionComponent[] = [
        {
          component: 'PersonalizedBanner',
          contentId: 'nonexistent',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-2');
      expect(result.replacedIds).toContain('nonexistent');
    });

    it('removes component when no homeBanner available', () => {
      const components: DecisionComponent[] = [
        {
          component: 'PersonalizedBanner',
          contentId: 'nonexistent',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, [
        { _id: 'content-1', _type: 'heroBanner', title: 'Hero' } as AvailableContent,
      ]);

      expect(result.components).toHaveLength(0);
      expect(result.removedComponents).toContain('PersonalizedBanner');
    });
  });

  describe('multiple components', () => {
    it('validates all components', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: 'content-1',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
        {
          component: 'FeaturedCategoryRail',
          contentId: 'should-be-null',
          propsOverrides: { handle: 'mens' },
          priority: 2,
          score: 0.7,
          reasoning: 'Test',
        },
        {
          component: 'PersonalizedBanner',
          contentId: 'invalid',
          propsOverrides: {},
          priority: 3,
          score: 0.6,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components).toHaveLength(3);
      expect(result.components[0].contentId).toBe('content-1');
      expect(result.components[1].contentId).toBeNull(); // FeaturedCategoryRail always null
      expect(result.components[2].contentId).toBe('content-2');
      // Note: FeaturedCategoryRail contentId is set to null by design, not logged as replaced
      expect(result.replacedIds).toContain('invalid');
    });
  });

  describe('edge cases', () => {
    it('handles empty components array', () => {
      const result = validateContentIds([], validContent);

      expect(result.components).toHaveLength(0);
    });

    it('handles empty availableContent', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: 'any-id',
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, []);

      expect(result.components).toHaveLength(0);
      expect(result.removedComponents).toContain('HeroBanner');
    });

    it('handles undefined contentId', () => {
      const components: DecisionComponent[] = [
        {
          component: 'HeroBanner',
          contentId: undefined as unknown as string,
          propsOverrides: {},
          priority: 1,
          score: 0.8,
          reasoning: 'Test',
        },
      ];

      const result = validateContentIds(components, validContent);

      expect(result.components[0].contentId).toBe('content-1');
    });
  });
});
