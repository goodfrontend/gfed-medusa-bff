import { HttpResponse, http } from 'msw';

import { mockHomeBannerData } from '@mocks/data/home-banner';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'your-project-id';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';
const apiVersion = process.env.SANITY_STUDIO_API_VERSION || '2023-05-03';
const sanityHttp = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

/* Success (i.e. happy path) handlers */
export const handlers = [
  http.get(sanityHttp, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (query && query.includes('homeBanner')) {
      return HttpResponse.json({
        result: mockHomeBannerData,
      });
    }
  }),
];

/* Other handlers */
export const emptyHomeBannerHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('homeBanner')) {
    return HttpResponse.json({
      result: {},
    });
  }
});

export const nullHomeBannerHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('homeBanner')) {
    return HttpResponse.json({
      result: null,
    });
  }
});

export const generalHomeBannerErrorHandler = http.get(sanityHttp, () => {
  return HttpResponse.json({ error: 'Sanity API error' }, { status: 500 });
});
