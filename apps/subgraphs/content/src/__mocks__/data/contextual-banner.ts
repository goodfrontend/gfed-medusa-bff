export const mockContextualBannerData = {
  title: 'Take your time - special financing available!',
  description: 'Need some time to decide? We offer flexible payment options.',
  ctaLabel: 'Learn about financing',
  ctaHref: '/financing',
  trigger: 'pdp-hesitation',
  minPrice: 200,
  isActive: true,
  priority: 1,
};

export const mockContextualBannerHighPriorityData = {
  title: "Don't miss out - limited stock available!",
  description: 'This item is selling fast. Secure yours now!',
  ctaLabel: 'Add to cart',
  ctaHref: '/cart',
  trigger: 'pdp-hesitation',
  minPrice: 200,
  isActive: true,
  priority: 5,
};

export const mockContextualBannerNoMinPriceData = {
  title: 'Welcome! Let us help you find what you need.',
  description: 'Browse our curated collections.',
  ctaLabel: 'Start shopping',
  ctaHref: '/collections',
  trigger: 'high-scroll-no-action',
  minPrice: null,
  isActive: true,
  priority: 3,
};
