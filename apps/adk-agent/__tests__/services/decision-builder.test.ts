import { describe, it, expect } from 'vitest';

import { buildDecisionWithMinimums } from '../../src/services/decision-builder';
import type { DecisionComponent, AvailableContent } from '../../src/types';

describe('buildDecisionWithMinimums', () => {
  const validContent: AvailableContent[] = [
    { _id: 'hero-1', _type: 'heroBanner', title: 'Hero' } as AvailableContent,
    { _id: 'hero-2', _type: 'heroBanner', title: 'Hero 2' } as AvailableContent,
    { _id: 'banner-1', _type: 'homeBanner', title: 'Banner' } as AvailableContent,
  ];

  const createComponent = (
    type: DecisionComponent['component'],
    contentId: string | null = null
  ): DecisionComponent => ({
    component: type,
    contentId,
    propsOverrides: type === 'FeaturedCategoryRail' ? { handle: 'mens' } : {},
    priority: 1,
    score: 0.8,
    reasoning: 'Test',
  });

  describe('minimum component enforcement', () => {
    it('keeps components unchanged when minimum met', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
        createComponent('FeaturedCategoryRail'),
        createComponent('PersonalizedBanner', 'banner-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'HIGH', validContent);

      expect(result.components).toHaveLength(3);
      expect(result.addedFallbacks).toHaveLength(0);
    });

    it('adds fallbacks for HIGH engagement (minimum 4) when content available', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'HIGH', validContent);

      // With 3 component types available, can add up to 3 unique types
      expect(result.components.length).toBeGreaterThanOrEqual(3);
      expect(result.addedFallbacks.length).toBeGreaterThan(0);
    });

    it('adds fallbacks for NEW user (minimum 3)', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent, 'NEW');

      expect(result.components.length).toBeGreaterThanOrEqual(3);
    });

    it('adds fallbacks for default (minimum 2)', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      expect(result.components.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('fallback component types', () => {
    it('adds HeroBanner fallback if missing and content available', () => {
      const components = [
        createComponent('FeaturedCategoryRail'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const hasHeroBanner = result.components.some(c => c.component === 'HeroBanner');
      expect(hasHeroBanner).toBe(true);
    });

    it('adds FeaturedCategoryRail fallback if missing', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const hasCategoryRail = result.components.some(c => c.component === 'FeaturedCategoryRail');
      expect(hasCategoryRail).toBe(true);
    });

    it('adds HeroBanner fallback if missing and content available', () => {
      const components = [
        createComponent('FeaturedCategoryRail'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      // HeroBanner is added first in fallback order
      const hasHeroBanner = result.components.some(c => c.component === 'HeroBanner');
      expect(hasHeroBanner).toBe(true);
    });

    it('skips HeroBanner fallback if no heroBanner content', () => {
      const components = [
        createComponent('FeaturedCategoryRail'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', [
        { _id: 'banner-1', _type: 'homeBanner', title: 'Banner' } as AvailableContent,
      ]);

      const hasHeroBanner = result.components.some(c => c.component === 'HeroBanner');
      expect(hasHeroBanner).toBe(false);
    });

    it('skips PersonalizedBanner fallback if no homeBanner content', () => {
      const components = [
        createComponent('FeaturedCategoryRail'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', [
        { _id: 'hero-1', _type: 'heroBanner', title: 'Hero' } as AvailableContent,
      ]);

      const hasPersonalizedBanner = result.components.some(c => c.component === 'PersonalizedBanner');
      expect(hasPersonalizedBanner).toBe(false);
    });
  });

  describe('fallback component properties', () => {
    it('sets priority to 99 for fallback components', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const fallbacks = result.components.filter(c => c.priority === 99);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('sets reasoning for fallback components', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const fallbacks = result.components.filter(c => c.reasoning.includes('Fallback'));
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('sets FeaturedCategoryRail handle to mens', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const categoryRail = result.components.find(c => c.component === 'FeaturedCategoryRail');
      expect(categoryRail?.propsOverrides.handle).toBe('mens');
    });
  });

  describe('deduplication', () => {
    it('does not add duplicate HeroBanner', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const heroBanners = result.components.filter(c => c.component === 'HeroBanner');
      expect(heroBanners.length).toBeLessThanOrEqual(2);
    });

    it('does not add duplicate FeaturedCategoryRail with same handle', () => {
      const components = [
        createComponent('FeaturedCategoryRail'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', validContent);

      const categoryRails = result.components.filter(
        c => c.component === 'FeaturedCategoryRail' && c.propsOverrides.handle === 'mens'
      );
      expect(categoryRails.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty components array', () => {
      const result = buildDecisionWithMinimums([], 'LOW', validContent);

      expect(result.components.length).toBeGreaterThanOrEqual(2);
    });

    it('handles undefined engagementLevel as LOW', () => {
      const components = [createComponent('HeroBanner', 'hero-1')];

      const result = buildDecisionWithMinimums(components, undefined as unknown as 'LOW', validContent);

      expect(result.components.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty availableContent', () => {
      const components = [
        createComponent('HeroBanner', 'hero-1'),
      ];

      const result = buildDecisionWithMinimums(components, 'LOW', []);

      const hasCategoryRail = result.components.some(c => c.component === 'FeaturedCategoryRail');
      expect(hasCategoryRail).toBe(true);
    });
  });
});
