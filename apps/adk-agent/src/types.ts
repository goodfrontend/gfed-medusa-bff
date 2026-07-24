export interface AvailableContent {
  _id: string;
  _type: string;
  title: string;
  headline: string;
  imageUrl: string;
  badge: string;
  subheadline: string;
  backgroundColor: string;
  cta: Record<string, unknown> | null;
  eyebrow: string;
  description: string;
  buttons: Array<Record<string, unknown>>;
  secondaryBanners: Array<Record<string, unknown>>;
  showPoweredBy: boolean;
}

export interface AvailableProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
  price: number | null;
  currencyCode: string | null;
  description: string;
}

export type ProductPreview = AvailableProduct;

export interface CategoryOption {
  handle: string;
  name: string;
  score: number;
}

export interface DecisionComponent {
  component: 'HeroBanner' | 'FeaturedCategoryRail' | 'PersonalizedBanner';
  contentId: string | null;
  propsOverrides: Record<string, unknown>;
  priority: number;
  score: number;
  reasoning: string;
}

export interface PersonalizationDecision {
  components: DecisionComponent[];
  reasoning: {
    intent: string;
    confidence: number;
    factors: string[];
    modelVersion: 'adk-v1';
  };
}

export type Intent = 'buy_now' | 'exploring' | 'price_shop' | 'uncertain';

export type LifecycleStage = 'NEW' | 'RETURNING' | 'FREQUENT' | 'LOYAL';

export type EngagementLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Extended Profile type for deterministic services
export interface IntentClassification {
  intent: Intent;
  confidence: number;
  factors: string[];
}

export interface CategoryAffinity {
  category: string;
  score: number;
  views?: number;
  purchases?: number;
}

export interface PriceSensitivity {
  score: number;
  avgViewedPrice?: number;
  dealClickRate?: number;
  enhanced?: {
    couponUsageCount?: number;
    saleClickRatio?: number;
  };
}

export interface IntentSignals {
  researchDepth?: number;
  checkoutConversion?: number;
}

export interface CurrentSession {
  pageViews?: number;
  duration?: number;
  cartAdds?: number;
}

export interface RecentDecision {
  timestamp: string | number;
  components: string[];
  intent: string;
  surface: string;
}

export interface Profile {
  lifecycleStage?: LifecycleStage;
  behavioralLifecycle?: LifecycleStage;
  engagementLevel?: EngagementLevel;
  orderCount?: number;
  sessionCount?: number;
  cartActivity?: number;
  hesitationCount?: number;
  categoryAffinity?: CategoryAffinity[] | Record<string, unknown>;
  priceSensitivity?: PriceSensitivity;
  intentSignals?: IntentSignals;
  recentProducts?: Array<{ id?: string; title?: string }>;
  searchHistory?: string[];
  recentDecisions?: RecentDecision[];
  momentumScore?: number;
  sessionQuality?: number;
  hesitationScore?: number;
  checkoutConversion?: number;
  currentSession?: CurrentSession;
}

export interface AgentContext {
  profile: Profile;
  availableContent: AvailableContent[];
  availableProducts: AvailableProduct[];
  deviceId: string;
  surface?: string;
  page?: string;
  intent?: Intent;
}

export interface ValidatedComponents {
  components: DecisionComponent[];
  replacedIds: string[];
  removedComponents: string[];
}
