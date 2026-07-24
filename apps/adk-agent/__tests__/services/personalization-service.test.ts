import { describe, it, expect } from 'vitest';

import { personalize } from '../../src/services/personalization-service';
import type { Profile, AvailableContent, AvailableProduct } from '../../src/types';

describe('personalize', () => {
  const validContent: AvailableContent[] = [
    { _id: 'hero-1', _type: 'heroBanner', title: 'Hero' } as AvailableContent,
    { _id: 'banner-1', _type: 'homeBanner', title: 'Banner' } as AvailableContent,
  ];

  const validProducts: AvailableProduct[] = [
    { id: 'prod-1', title: 'Product 1', handle: 'product-1', thumbnail: '', price: 100, currencyCode: 'usd', description: '' },
  ];

  describe('orchestration', () => {
    it('classifies intent from profile', () => {
      const profile: Profile = {
        priceSensitivity: { score: 0.7 },
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.intentClassification.intent).toBe('price_shop');
    });

    it('validates contentIds in components', () => {
      const profile: Profile = {};
      const result = personalize(profile, validContent, validProducts);

      for (const component of result.decision.components) {
        if (component.component === 'HeroBanner' || component.component === 'PersonalizedBanner') {
          const validIds = validContent.map(c => c._id);
          if (component.contentId) {
            expect(validIds).toContain(component.contentId);
          }
        }
        if (component.component === 'FeaturedCategoryRail') {
          expect(component.contentId).toBeNull();
        }
      }
    });

    it('enforces minimum component counts', () => {
      const profile: Profile = {
        momentumScore: 0.8,
        cartActivity: 1,
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.decision.components.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('context preparation', () => {
    it('prepares context with profile data', () => {
      const profile: Profile = {
        lifecycleStage: 'LOYAL',
        orderCount: 10,
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.context.profile).toEqual(profile);
      expect(result.context.availableContent).toEqual(validContent);
      expect(result.context.availableProducts).toEqual(validProducts);
    });

    it('includes intent in context', () => {
      const profile: Profile = {
        checkoutConversion: 0.6,
        lifecycleStage: 'LOYAL',
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.context.intent).toBe('buy_now');
    });
  });

  describe('decision structure', () => {
    it('returns valid PersonalizationDecision', () => {
      const profile: Profile = {};

      const result = personalize(profile, validContent, validProducts);

      expect(result.decision.components).toBeInstanceOf(Array);
      expect(result.decision.reasoning.intent).toBeDefined();
      expect(result.decision.reasoning.confidence).toBeGreaterThanOrEqual(0);
      expect(result.decision.reasoning.factors).toBeInstanceOf(Array);
      expect(result.decision.reasoning.modelVersion).toBe('adk-v1');
    });

    it('sets modelVersion to adk-v1', () => {
      const profile: Profile = {};

      const result = personalize(profile, validContent, validProducts);

      expect(result.decision.reasoning.modelVersion).toBe('adk-v1');
    });
  });

  describe('fallback behavior', () => {
    it('returns fallback decision when no content available', () => {
      const profile: Profile = {};

      const result = personalize(profile, [], []);

      expect(result.decision.components.length).toBeGreaterThanOrEqual(1);
      const hasCategoryRail = result.decision.components.some(
        c => c.component === 'FeaturedCategoryRail'
      );
      expect(hasCategoryRail).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('handles price-conscious returning visitor', () => {
      const profile: Profile = {
        lifecycleStage: 'RETURNING',
        priceSensitivity: { score: 0.8 },
        sessionCount: 5,
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.intentClassification.intent).toBe('price_shop');
      expect(result.decision.components.length).toBeGreaterThanOrEqual(2);
    });

    it('handles loyal user ready to buy', () => {
      const profile: Profile = {
        lifecycleStage: 'LOYAL',
        checkoutConversion: 0.7,
        cartActivity: 2,
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.intentClassification.intent).toBe('buy_now');
    });

    it('handles new user exploring', () => {
      const profile: Profile = {
        lifecycleStage: 'NEW',
        sessionCount: 1,
      };

      const result = personalize(profile, validContent, validProducts);

      expect(result.intentClassification.intent).toBe('exploring');
      expect(result.decision.components.length).toBeGreaterThanOrEqual(3);
    });
  });
});
