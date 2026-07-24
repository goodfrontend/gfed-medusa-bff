jest.mock('../config/sanity', () => ({
  sanityClient: {
    fetch: jest.fn(),
  },
  sanityConfig: {
    projectId: 'test',
    dataset: 'test',
    useCdn: true,
    apiVersion: '2023-05-03',
  },
}));

const { sanityClient } = require('../config/sanity');
const {
  fetchAvailableContent,
} = require('../services/personalization/sanity-content');

describe('Sanity Content — homepage surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchAvailableContent("homepage") includes homeBanner fields in GROQ query', async () => {
    (sanityClient.fetch as jest.Mock).mockResolvedValue([
      {
        _id: 'banner-1',
        _type: 'heroBanner',
        title: 'Hero Title',
        headline: 'Hero Headline',
        imageUrl: '/test.jpg',
      },
      {
        _id: 'banner-2',
        _type: 'homeBanner',
        title: 'Home Banner Title',
        eyebrow: 'Sale',
        description: 'Big sale description',
        imageUrl: '/home-test.jpg',
        showPoweredBy: true,
      },
    ]);

    const result = await fetchAvailableContent('homepage');

    expect(sanityClient.fetch).toHaveBeenCalledTimes(1);

    const [query, params] = (sanityClient.fetch as jest.Mock).mock.calls[0];

    expect(params.contentTypes).toEqual(
      expect.arrayContaining(['heroBanner', 'homeBanner'])
    );
    expect(params.surface).toBe('homepage');

    expect(query).toContain('eyebrow');
    expect(query).toContain('description');
    expect(query).toContain('buttons');
    expect(query).toContain('secondaryBanners');
    expect(query).toContain('showPoweredBy');

    expect(result).toHaveLength(2);
    const homeBanner = result.find(
      (r: Record<string, unknown>) => r._type === 'homeBanner'
    );
    expect(homeBanner).toBeDefined();
    expect(homeBanner!.eyebrow).toBe('Sale');
    expect(homeBanner!.description).toBe('Big sale description');
    expect(homeBanner!.showPoweredBy).toBe(true);
  });

  it('fetchAvailableContent("homepage_hero") does not include homeBanner', async () => {
    (sanityClient.fetch as jest.Mock).mockResolvedValue([]);

    await fetchAvailableContent('homepage_hero');

    const [, params] = (sanityClient.fetch as jest.Mock).mock.calls[0];
    expect(params.contentTypes).toEqual(['heroBanner']);
  });
});
