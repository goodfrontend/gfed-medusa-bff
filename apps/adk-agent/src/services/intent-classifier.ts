import type { Profile, Intent, IntentClassification } from '../types';
import {
  PRICE_SENSITIVITY_THRESHOLD,
  SALE_CLICK_RATIO_THRESHOLD,
  CHECKOUT_CONVERSION_THRESHOLD,
  MOMENTUM_SCORE_BUY_NOW_THRESHOLD,
  HESITATION_COUNT_THRESHOLD,
  SESSION_QUALITY_THRESHOLD,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  CONFIDENCE_LOW,
} from '../config/constants';

/**
 * Classify user intent from profile signals.
 * 
 * Priority order (highest to lowest):
 * 1. price_shop - high price sensitivity or deal-seeking behavior
 * 2. buy_now - ready to purchase (LOYAL + checkout conversion OR high momentum + cart activity)
 * 3. uncertain - hesitation or low session quality
 * 4. exploring - default fallback
 */
export function classifyIntent(profile: Profile): IntentClassification {
  const factors: string[] = [];
  let intent: Intent = 'exploring';
  let confidence = CONFIDENCE_LOW;

  // Extract profile values with defaults
  const priceSensitivity = profile.priceSensitivity?.score ?? 0;
  const saleClickRatio = profile.priceSensitivity?.enhanced?.saleClickRatio ?? 0;
  const checkoutConversion = profile.intentSignals?.checkoutConversion ?? profile.checkoutConversion ?? 0;
  const behavioralLifecycle = profile.behavioralLifecycle ?? profile.lifecycleStage ?? '';
  const lifecycleStage = profile.lifecycleStage ?? '';
  const momentumScore = profile.momentumScore ?? 0;
  const cartActivity = profile.cartActivity ?? 0;
  const hesitationCount = profile.hesitationCount ?? 0;
  const sessionQuality = profile.sessionQuality ?? 1;

  // Priority 1: price_shop (highest priority)
  if (priceSensitivity > PRICE_SENSITIVITY_THRESHOLD) {
    intent = 'price_shop';
    confidence = CONFIDENCE_HIGH;
    factors.push('price_sensitivity_high');
    return { intent, confidence, factors };
  }

  if (saleClickRatio > SALE_CLICK_RATIO_THRESHOLD) {
    intent = 'price_shop';
    confidence = CONFIDENCE_HIGH;
    factors.push('sale_click_ratio_high');
    return { intent, confidence, factors };
  }

  // Priority 2: buy_now
  if (
    checkoutConversion > CHECKOUT_CONVERSION_THRESHOLD &&
    (behavioralLifecycle === 'LOYAL' || lifecycleStage === 'LOYAL')
  ) {
    intent = 'buy_now';
    confidence = CONFIDENCE_HIGH;
    factors.push('loyal_with_checkout');
    return { intent, confidence, factors };
  }

  if (momentumScore > MOMENTUM_SCORE_BUY_NOW_THRESHOLD && cartActivity > 0) {
    intent = 'buy_now';
    confidence = CONFIDENCE_MEDIUM;
    factors.push('high_momentum_with_cart');
    return { intent, confidence, factors };
  }

  // Priority 3: uncertain
  if (hesitationCount > HESITATION_COUNT_THRESHOLD) {
    intent = 'uncertain';
    confidence = CONFIDENCE_MEDIUM;
    factors.push('high_hesitation');
    return { intent, confidence, factors };
  }

  if (sessionQuality < SESSION_QUALITY_THRESHOLD) {
    intent = 'uncertain';
    confidence = CONFIDENCE_MEDIUM;
    factors.push('low_session_quality');
    return { intent, confidence, factors };
  }

  // Priority 4: exploring (fallback)
  factors.push('default_fallback');
  return { intent, confidence, factors };
}
