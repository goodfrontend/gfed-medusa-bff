import { sanityClient } from '../../config/sanity';
import { Footer, QueryFooterArgs } from '../../generated/graphql';
import { FOOTER_QUERY } from './groq-queries';

export const footerResolvers = {
  Query: {
    footer: async (
      _parent: unknown,
      args: QueryFooterArgs
    ): Promise<Footer | null> => {
      try {
        const result = await sanityClient.fetch(FOOTER_QUERY, {
          footerId: args.footerId,
        });
        return result;
      } catch (error) {
        console.error('Error fetching footer content from Sanity:', error);
        return null;
      }
    },
  },
};
