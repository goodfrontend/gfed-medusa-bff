import { sanityClient } from '../../config/sanity';
import { HomeBanner } from '../../generated/graphql';
import { HOME_BANNER_QUERY } from './groq-queries';

interface HomeBannerArgs {
  audience?: string | null;
  segment?: string | null;
}

export const homeBannerResolvers = {
  Query: {
    homeBanner: async (
      _: unknown,
      args: HomeBannerArgs
    ): Promise<HomeBanner | null> => {
      try {
        const { audience, segment } = args;
        const params = { audience, segment };
        const result = await sanityClient.fetch(HOME_BANNER_QUERY, params);
        return result;
      } catch (error) {
        console.error('Error fetching home banner content from Sanity:', error);
        return null;
      }
    },
  },
};
