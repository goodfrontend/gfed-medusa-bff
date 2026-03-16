import { mockHomeBannerData } from '@mocks/data/home-banner';
import {
  emptyHomeBannerHandler,
  generalHomeBannerErrorHandler,
  nullHomeBannerHandler,
} from '@mocks/msw/handlers/home-banner';
import { server } from '@mocks/msw/node';
import { homeBannerResolvers } from '@resolvers/home-banner';
import { createClient } from '@sanity/client';

describe('Home Banner Resolvers', () => {
  let mockContext: any;

  beforeEach(() => {
    const mockSanityClient = createClient({
      projectId: process.env.SANITY_STUDIO_PROJECT_ID,
      dataset: process.env.SANITY_STUDIO_DATASET,
      apiVersion: process.env.SANITY_STUDIO_API_VERSION,
      useCdn: false,
    });

    mockContext = {
      sanityClient: mockSanityClient,
    };
  });

  describe('Query.homeBanner', () => {
    it('should handle successful home banner retrieval', async () => {
      const result = await homeBannerResolvers.Query.homeBanner();

      expect(result).toEqual(mockHomeBannerData);
      if (result) {
        expect(result.title).toBe('A simple banner you can edit in Sanity');
        expect(result.buttons).toHaveLength(2);
        expect(result.image?.asset?.url).toContain('home-banner-sample');
      }
    });

    it('should handle empty home banner content', async () => {
      server.use(emptyHomeBannerHandler);

      const result = await homeBannerResolvers.Query.homeBanner();

      expect(result).toEqual({});
    });

    it('should handle null home banner content', async () => {
      server.use(nullHomeBannerHandler);

      const result = await homeBannerResolvers.Query.homeBanner();

      expect(result).toBeNull();
    });

    it('should handle service errors properly', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      server.use(generalHomeBannerErrorHandler);

      const result = await homeBannerResolvers.Query.homeBanner();
      expect(result).toEqual(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching home banner content from Sanity:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle data integrity with JSON serialization', async () => {
      const result = await homeBannerResolvers.Query.homeBanner();

      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized).toEqual(mockHomeBannerData);
    });
  });
});
