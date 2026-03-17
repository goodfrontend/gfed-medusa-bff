import { sanityClient } from '../../config/sanity';
import { HomeBanner } from '../../generated/graphql';
import { HOME_BANNER_QUERY } from './groq-queries';

export const homeBannerResolvers = {
  Query: {
    homeBanner: async (): Promise<HomeBanner | null> => {
      try {
        const result = await sanityClient.fetch(HOME_BANNER_QUERY);
        return result;
      } catch (error) {
        console.error('Error fetching home banner content from Sanity:', error);
        return null;
      }
    },
  },
};
