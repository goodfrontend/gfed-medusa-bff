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
    surfaces: ['homepage_hero'],
    weight: 1.0,
  },
];

export function getComponentsForSurface(
  surface: string
): ComponentDefinition[] {
  return componentRegistry.filter((c) => c.surfaces.includes(surface));
}
