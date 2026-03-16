export const mockHomeBannerData = {
  _id: 'homeBannerId',
  _type: 'homeBanner',
  eyebrow: 'Fresh from the studio',
  title: 'A simple banner you can edit in Sanity',
  description:
    'Highlight a collection, campaign, or store story here without touching code.',
  footerNote: 'Powered by Sanity CMS',
  buttons: [
    {
      label: 'Shop new arrivals',
      href: '/collections/new-arrivals',
      openInNewTab: false,
    },
    {
      label: 'Browse best sellers',
      href: '/collections',
      openInNewTab: false,
    },
  ],
  image: {
    alt: 'Sample editorial artwork for the home banner',
    asset: {
      url: 'https://cdn.sanity.io/images/demo/production/home-banner-sample.png',
    },
  },
};
