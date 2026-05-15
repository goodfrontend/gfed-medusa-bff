export interface ComponentDefinition {
  name: string;
  description: string;
  requiredProps: string[];
  optionalProps: string[];
  contentTypes: string[];
  surfaces: string[];
  weight: number;
}

export const componentRegistry: ComponentDefinition[] = [
  {
    name: 'HeroBanner',
    description:
      'Full-width banner with headline, image, CTA, optional badge. Primary promotional surface.',
    requiredProps: ['headline', 'imageUrl', 'cta'],
    optionalProps: ['badge', 'subheadline', 'backgroundColor'],
    contentTypes: ['heroBanner', 'promotionalBanner'],
    surfaces: ['homepage_hero'],
    weight: 1.0,
  },
  {
    name: 'ProductCarousel',
    description:
      'Horizontal scrollable carousel of product cards for recommendations or showcases.',
    requiredProps: ['productIds', 'title'],
    optionalProps: ['strategy', 'maxItems', 'layout'],
    contentTypes: [],
    surfaces: [
      'homepage_hero',
      'category_page',
      'product_detail',
      'cart_page',
      'search_results',
    ],
    weight: 1.0,
  },
  {
    name: 'TrustBar',
    description:
      'Trust badges — free shipping, returns, security icons to reduce purchase anxiety.',
    requiredProps: ['badges'],
    optionalProps: ['message', 'layout'],
    contentTypes: ['trustBadge'],
    surfaces: ['checkout', 'product_detail', 'cart_page'],
    weight: 0.8,
  },
  {
    name: 'CategoryGrid',
    description:
      'Grid of category tiles with images for browsing-oriented surfaces.',
    requiredProps: ['categories'],
    optionalProps: ['layout', 'maxColumns'],
    contentTypes: ['categoryTile'],
    surfaces: ['homepage_hero', 'category_page'],
    weight: 0.8,
  },
  {
    name: 'SocialProofBanner',
    description:
      'Recent purchases, visitor count, or review counts for social proof.',
    requiredProps: ['message'],
    optionalProps: ['productId', 'count'],
    contentTypes: ['socialProof'],
    surfaces: ['product_detail', 'checkout'],
    weight: 0.6,
  },
  {
    name: 'ReviewCarousel',
    description: 'Customer reviews and ratings carousel.',
    requiredProps: ['reviewIds'],
    optionalProps: ['productId', 'layout'],
    contentTypes: [],
    surfaces: ['product_detail', 'checkout'],
    weight: 0.6,
  },
  {
    name: 'UpsellBlock',
    description: 'Related or frequently-bought-together products.',
    requiredProps: ['productIds', 'title'],
    optionalProps: ['strategy', 'message'],
    contentTypes: [],
    surfaces: ['product_detail', 'cart_page'],
    weight: 0.7,
  },
  {
    name: 'EmailCapture',
    description:
      'Email signup form with incentive (e.g., 10% off first order).',
    requiredProps: ['incentive'],
    optionalProps: ['headline', 'subheadline'],
    contentTypes: ['emailCapture'],
    surfaces: ['homepage_hero'],
    weight: 0.4,
  },
  {
    name: 'UrgencyBanner',
    description:
      'Time-limited offer or low-stock alert to create purchase urgency.',
    requiredProps: ['headline', 'deadline'],
    optionalProps: ['message', 'style'],
    contentTypes: ['urgencyBanner'],
    surfaces: ['homepage_hero', 'product_detail', 'cart_page'],
    weight: 0.5,
  },
];

export function getComponentsForSurface(
  surface: string
): ComponentDefinition[] {
  return componentRegistry.filter((c) => c.surfaces.includes(surface));
}
