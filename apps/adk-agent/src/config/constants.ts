/**
 * Constants for personalization agent
 * Extracted from magic numbers for configurability
 */

// Intent classification thresholds
export const PRICE_SENSITIVITY_THRESHOLD = 0.6;
export const SALE_CLICK_RATIO_THRESHOLD = 0.5;
export const CHECKOUT_CONVERSION_THRESHOLD = 0.5;
export const MOMENTUM_SCORE_BUY_NOW_THRESHOLD = 0.7;
export const HESITATION_COUNT_THRESHOLD = 2;
export const SESSION_QUALITY_THRESHOLD = 0.3;

// Component minimums
export const MIN_COMPONENTS_DEFAULT = 2;
export const MIN_COMPONENTS_NEW_USER = 3;
export const MIN_COMPONENTS_HIGH_ENGAGEMENT = 4;

// Engagement level determination
export const MOMENTUM_SCORE_HIGH_ENGAGEMENT = 0.7;

// Content types
export const CONTENT_TYPE_HERO_BANNER = 'heroBanner';
export const CONTENT_TYPE_HOME_BANNER = 'homeBanner';

// Component types
export const COMPONENT_HERO_BANNER = 'HeroBanner';
export const COMPONENT_FEATURED_CATEGORY_RAIL = 'FeaturedCategoryRail';
export const COMPONENT_PERSONALIZED_BANNER = 'PersonalizedBanner';

// Default fallback values
export const DEFAULT_CATEGORY_HANDLE = 'mens';
export const DEFAULT_CATEGORY_TITLE = 'Shop Men';

// Priority for fallback components
export const FALLBACK_COMPONENT_PRIORITY = 99;

// Confidence levels
export const CONFIDENCE_HIGH = 0.9;
export const CONFIDENCE_MEDIUM = 0.7;
export const CONFIDENCE_LOW = 0.5;
