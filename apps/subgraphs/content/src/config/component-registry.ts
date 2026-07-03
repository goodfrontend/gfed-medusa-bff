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
    contentTypes: ['heroBanner'],
    surfaces: ['homepage_hero', 'homepage'],
    weight: 1.0,
  },
  {
    name: 'FeaturedCategoryRail',
    description:
      'Product rail showing items for a specific category. Data sourced from Medusa.',
    requiredProps: ['title', 'handle'],
    optionalProps: ['products'],
    contentTypes: [],
    surfaces: ['homepage'],
    weight: 0.9,
  },
  {
    name: 'PersonalizedBanner',
    description:
      'Segment-aware promotional banner with title, eyebrow, description, image, buttons.',
    requiredProps: ['title'],
    optionalProps: ['eyebrow', 'description', 'image', 'buttons', 'secondaryBanners', 'showPoweredBy'],
    contentTypes: ['homeBanner'],
    surfaces: ['homepage'],
    weight: 0.8,
  },
  {
    name: 'ProductRecommendation',
    description: 'Single product recommendation card with image, title, price, and CTA. AI selects from top-affinity categories.',
    requiredProps: ['productId', 'title', 'handle', 'thumbnail', 'price', 'currencyCode'],
    optionalProps: [],
    contentTypes: [],
    surfaces: ['homepage'],
    weight: 0.7,
  },
];

export function getComponentsForSurface(
  surface: string
): ComponentDefinition[] {
  return componentRegistry.filter((c) => c.surfaces.includes(surface));
}
