import { contextualBannerResolvers } from '@resolvers/contextual-banner';

describe('Contextual Banner Resolvers', () => {
  describe('Query.contextualBanners', () => {
    it('should return an array', async () => {
      const result = await contextualBannerResolvers.Query.contextualBanners();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
