export const HOME_BANNER_QUERY = `coalesce(
  *[_id == "homeBannerId"][0],
  *[_type == "homeBanner"] | order(_updatedAt desc)[0]
){
  _id,
  _type,
  eyebrow,
  title,
  description,
  footerNote,
  buttons[]{
    label,
    href,
    openInNewTab
  },
  secondaryBanners[]{
    title,
    description,
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
