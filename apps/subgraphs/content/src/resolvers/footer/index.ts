import { sanityClient } from '../../config/sanity';
import { FOOTER_QUERY } from './groq-queries';

export const footerResolvers = {
  Query: {
    footer: async (_parent: unknown, args: { footerId?: string }) => {
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

  RichTextBlock: {
    __resolveType(obj: { _type: string }) {
      if (obj._type === 'block') {
        return 'TextBlock';
      }
      if (obj._type === 'image') {
        return 'ImageBlock';
      }
      if (obj._type === 'file') {
        return 'FileBlock';
      }
      return null;
    },
  },
  MarkDef: {
    __resolveType(obj: { _type: string }) {
      if (obj._type === 'link') {
        return 'LinkMark';
      }
      if (obj._type === 'iconlink') {
        return 'IconLinkMark';
      }
      return null;
    },
  },
};
