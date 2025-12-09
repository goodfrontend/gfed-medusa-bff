import { HttpResponse, http } from 'msw';

import { mockFooterData } from '@mocks/data/footer';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'your-project-id';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';
const apiVersion = process.env.SANITY_STUDIO_API_VERSION || '2023-05-03';
const sanityHttp = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}`;

/* Success (i.e. happy path) handlers */
export const handlers = [
  http.get(sanityHttp, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (query && query.includes('footer')) {
      return HttpResponse.json({
        result: mockFooterData,
      });
    }

    return HttpResponse.json({
      result: [],
    });
  }),
];

/* Other handlers */
export const emptyFooterHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('footer')) {
    return HttpResponse.json({
      result: {},
    });
  }

  return HttpResponse.json({
    result: [],
  });
});

export const nullFooterHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('footer')) {
    return HttpResponse.json({
      result: null,
    });
  }

  return HttpResponse.json({
    result: [],
  });
});

export const undefinedFooterHandler = http.get(sanityHttp, ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (query && query.includes('footer')) {
    return HttpResponse.json({
      result: undefined,
    });
  }

  return HttpResponse.json({
    result: [],
  });
});

export const generalErrorHandler = http.get(sanityHttp, () => {
  return HttpResponse.json({ error: 'Sanity API error' }, { status: 500 });
});

export const authErrorHandler = http.get(sanityHttp, () => {
  return HttpResponse.json(
    { error: 'Unauthorized - Invalid API token' },
    { status: 401 }
  );
});

export const queryErrorHandler = http.get(sanityHttp, () => {
  return HttpResponse.json(
    { error: 'Invalid GROQ query syntax' },
    { status: 400 }
  );
});
