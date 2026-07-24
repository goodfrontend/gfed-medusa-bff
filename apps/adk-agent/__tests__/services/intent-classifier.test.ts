import { describe, it, expect } from 'vitest';

import { classifyIntent } from '../../src/services/intent-classifier';
import type { Profile } from '../../src/types';

describe('classifyIntent', () => {
  describe('price_shop intent', () => {
    it('returns price_shop when priceSensitivity.score > 0.6', () => {
      const profile: Profile = {
        priceSensitivity: { score: 0.7 },
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('price_shop');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.factors).toContain('price_sensitivity_high');
    });

    it('returns price_shop when enhanced.saleClickRatio > 0.5', () => {
      const profile: Profile = {
        priceSensitivity: {
          score: 0.3,
          enhanced: { saleClickRatio: 0.6 },
        },
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('price_shop');
      expect(result.factors).toContain('sale_click_ratio_high');
    });

    it('prioritizes price_shop over other intents', () => {
      const profile: Profile = {
        priceSensitivity: { score: 0.7 },
        checkoutConversion: 0.8,
        lifecycleStage: 'LOYAL',
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('price_shop');
    });
  });

  describe('buy_now intent', () => {
    it('returns buy_now when checkoutConversion > 0.5 and lifecycleStage is LOYAL', () => {
      const profile: Profile = {
        checkoutConversion: 0.6,
        lifecycleStage: 'LOYAL',
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
      expect(result.factors).toContain('loyal_with_checkout');
    });

    it('returns buy_now when behavioralLifecycle is LOYAL with checkoutConversion', () => {
      const profile: Profile = {
        checkoutConversion: 0.6,
        behavioralLifecycle: 'LOYAL',
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
    });

    it('returns buy_now when momentumScore > 0.7 and cartActivity > 0', () => {
      const profile: Profile = {
        momentumScore: 0.8,
        cartActivity: 1,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
      expect(result.factors).toContain('high_momentum_with_cart');
    });

    it('does not return buy_now when cartActivity is 0', () => {
      const profile: Profile = {
        momentumScore: 0.8,
        cartActivity: 0,
      };

      const result = classifyIntent(profile);

      expect(result.intent).not.toBe('buy_now');
    });
  });

  describe('uncertain intent', () => {
    it('returns uncertain when hesitationCount > 2', () => {
      const profile: Profile = {
        hesitationCount: 3,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('uncertain');
      expect(result.factors).toContain('high_hesitation');
    });

    it('returns uncertain when sessionQuality < 0.3', () => {
      const profile: Profile = {
        sessionQuality: 0.2,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('uncertain');
      expect(result.factors).toContain('low_session_quality');
    });

    it('does not override buy_now with uncertain', () => {
      const profile: Profile = {
        hesitationCount: 3,
        checkoutConversion: 0.6,
        lifecycleStage: 'LOYAL',
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
    });
  });

  describe('exploring intent (fallback)', () => {
    it('returns exploring when no specific signals match', () => {
      const profile: Profile = {};

      const result = classifyIntent(profile);

      expect(result.intent).toBe('exploring');
      expect(result.factors).toContain('default_fallback');
    });

    it('returns exploring with low engagement signals', () => {
      const profile: Profile = {
        sessionCount: 2,
        orderCount: 0,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('exploring');
    });
  });

  describe('priority rules', () => {
    it('price_shop > buy_now', () => {
      const profile: Profile = {
        priceSensitivity: { score: 0.7 },
        checkoutConversion: 0.6,
        lifecycleStage: 'LOYAL',
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('price_shop');
    });

    it('buy_now > uncertain', () => {
      const profile: Profile = {
        checkoutConversion: 0.6,
        lifecycleStage: 'LOYAL',
        hesitationCount: 3,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
    });

    it('uncertain > exploring', () => {
      const profile: Profile = {
        hesitationCount: 3,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('uncertain');
    });
  });

  describe('edge cases', () => {
    it('handles null profile gracefully', () => {
      const result = classifyIntent({});

      expect(result.intent).toBe('exploring');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('handles undefined nested fields', () => {
      const profile: Profile = {
        priceSensitivity: undefined,
        intentSignals: undefined,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('exploring');
    });

    it('uses behavioralLifecycle over lifecycleStage', () => {
      const profile: Profile = {
        behavioralLifecycle: 'LOYAL',
        lifecycleStage: 'NEW',
        checkoutConversion: 0.6,
      };

      const result = classifyIntent(profile);

      expect(result.intent).toBe('buy_now');
      expect(result.factors).toContain('loyal_with_checkout');
    });
  });
});
