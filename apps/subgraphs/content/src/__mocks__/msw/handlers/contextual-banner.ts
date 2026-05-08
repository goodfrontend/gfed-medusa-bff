import { HttpResponse, http } from 'msw';

import {
  mockContextualBannerData,
  mockContextualBannerNoMinPriceData,
} from '@mocks/data/contextual-banner';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'your-project-id';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';
const apiVersion = process.env.SANITY_STUDIO_API_VERSION || '2023-05-03';
const sanityHttp = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

export const handlers = [
  http.get(sanityHttp, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (query && query.includes('contextualBanner')) {
      if (query.includes('pdp-hesitation')) {
        return HttpResponse.json({
          result: mockContextualBannerData,
        });
      }

      if (query.includes('high-scroll-no-action')) {
        return HttpResponse.json({
          result: mockContextualBannerNoMinPriceData,
        });
      }

      return HttpResponse.json({
        result: null,
      });
    }
  }),
];

export const contextualBannerHighPriorityHandler = http.get(
  sanityHttp,
  ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (query && query.includes('contextualBanner')) {
      return HttpResponse.json({
        result: mockContextualBannerHighPriorityData,
      });
    }
  }
);

export const emptyContextualBannerHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('contextualBanner')) {
    return HttpResponse.json({
      result: {},
    });
  }
});

export const nullContextualBannerHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('contextualBanner')) {
    return HttpResponse.json({
      result: null,
    });
  }
});

export const contextualBannerErrorHandler = http.get(sanityHttp, () => {
  return HttpResponse.json({ error: 'Sanity API error' }, { status: 500 });
});