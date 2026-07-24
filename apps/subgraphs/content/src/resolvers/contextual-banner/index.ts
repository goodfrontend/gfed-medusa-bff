import { sanityClient } from '../../config/sanity';
import { ContextualBanner } from '../../generated/graphql';
import { CONTEXTUAL_BANNERS_QUERY } from './groq-queries';

export const contextualBannerResolvers = {
  Query: {
    contextualBanners: async (): Promise<ContextualBanner[]> => {
      try {
        const result = await sanityClient.fetch(CONTEXTUAL_BANNERS_QUERY);
        return result || [];
      } catch (error) {
        console.error('Error fetching contextual banners from Sanity:', error);
        return [];
      }
    },
  },
};
