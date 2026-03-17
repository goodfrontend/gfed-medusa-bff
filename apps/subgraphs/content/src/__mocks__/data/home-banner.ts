export const mockHomeBannerData = {
  _id: 'homeBannerId',
  _type: 'homeBanner',
  eyebrow: 'Fresh from the studio',
  title: 'A simple banner you can edit in Sanity',
  description:
    'Highlight a collection, campaign, or store story here without touching code.',
  showPoweredBy: true,
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
  secondaryBanners: [
    {
      title: 'Editorial picks for everyday routines',
      description: 'A smaller supporting banner for category highlights or curated edits.',
      showPoweredBy: true,
      image: {
        alt: 'Editorial lifestyle image for everyday routines',
        asset: {
          url: 'https://cdn.sanity.io/images/demo/production/secondary-banner-one.png',
        },
      },
      button: {
        label: 'Explore the edit',
        href: '/collections',
        openInNewTab: false,
      },
    },
    {
      title: 'A quick story block for seasonal campaigns',
      description: 'Keep it simple with one short message and one supporting link.',
      showPoweredBy: false,
      image: {
        alt: 'Seasonal campaign image for the secondary banner',
        asset: {
          url: 'https://cdn.sanity.io/images/demo/production/secondary-banner-two.png',
        },
      },
      button: {
        label: 'Read the story',
        href: '/collections/new-arrivals',
        openInNewTab: false,
      },
    },
  ],
  image: {
    alt: 'Sample editorial artwork for the home banner',
    asset: {
      url: 'https://cdn.sanity.io/images/demo/production/home-banner-sample.png',
    },
  },
};
