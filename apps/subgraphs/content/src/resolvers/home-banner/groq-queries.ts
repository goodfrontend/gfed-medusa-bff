export const HOME_BANNER_QUERY = `coalesce(
  *[_id == "homeBannerId"][0],
  *[_type == "homeBanner"] | order(_updatedAt desc)[0]
){
  _id,
  _type,
  eyebrow,
  title,
  description,
  "showPoweredBy": coalesce(showPoweredBy, footerNote == "Powered by Sanity CMS", false),
  buttons[]{
    label,
    href,
    openInNewTab
  },
  secondaryBanners[]{
    title,
    description,
    "showPoweredBy": coalesce(showPoweredBy, false),
    image{
      alt,
      asset->{
        url
      }
    },
    button{
      label,
      href,
      openInNewTab
    }
  },
  image{
    alt,
    asset->{
      url
    }
  }
}`;
