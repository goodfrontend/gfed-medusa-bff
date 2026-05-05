export const HOME_BANNER_QUERY = `coalesce(
  *[_id == "homeBannerId"][0],
  *[_type == "homeBanner"] | order(_updatedAt desc)[0]
){
  _id,
  _type,
  // Main banner fields - audience-enabled (handle both old string and new object shapes)
  "eyebrow": coalesce(
    eyebrow.segments[audienceId == $audience && segmentId == $segment][0].value,
    eyebrow.default,
    eyebrow  // fallback to old plain string
  ),
  "title": coalesce(
    title.segments[audienceId == $audience && segmentId == $segment][0].value,
    title.default,
    title  // fallback to old plain string
  ),
  "description": coalesce(
    description.segments[audienceId == $audience && segmentId == $segment][0].value,
    description.default,
    description  // fallback to old plain string
  ),
  "image": coalesce(
    image.segments[audienceId == $audience && segmentId == $segment][0].value,
    image.default,
    image  // fallback to old plain string
  ) {
    alt,
    asset-> { url }
  },
  "showPoweredBy": coalesce(showPoweredBy, false),
  // Buttons - NOT audience-enabled in Phase 1
  buttons[] {
    label,
    href,
    openInNewTab
  },
  // Secondary banners - with audience support for title, description, image
  secondaryBanners[] {
    "title": coalesce(
      title.segments[audienceId == $audience && segmentId == $segment][0].value,
      title.default,
      title  // fallback to old plain string
    ),
    "description": coalesce(
      description.segments[audienceId == $audience && segmentId == $segment][0].value,
      description.default,
      description  // fallback to old plain string
    ),
    "showPoweredBy": coalesce(showPoweredBy, false),
    "image": coalesce(
      image.segments[audienceId == $audience && segmentId == $segment][0].value,
      image.default,
      image  // fallback to old plain string
    ) {
      alt,
      asset-> { url }
    },
    button {
      label,
      href,
      openInNewTab
    }
  }
}`;
