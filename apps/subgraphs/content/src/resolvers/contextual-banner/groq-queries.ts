export const CONTEXTUAL_BANNERS_QUERY = `*[_type == "contextualBanner" && isActive == true] | order(priority desc) {
  title,
  description,
  ctaLabel,
  ctaHref,
  trigger,
  minPrice,
  isActive,
  priority
}`;
