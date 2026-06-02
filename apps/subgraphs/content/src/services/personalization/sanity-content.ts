import { getComponentsForSurface } from '../../config/component-registry';
import { sanityClient } from '../../config/sanity';
import { logger } from './logger';

const SANITY_CACHE_TTL = 5 * 60 * 1000;
const sanityContentCache = new Map<
  string,
  { data: Array<Record<string, unknown>>; expiresAt: number }
>();

function getCachedContent(
  surface: string
): Array<Record<string, unknown>> | null {
  const entry = sanityContentCache.get(surface);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  sanityContentCache.delete(surface);
  return null;
}

function setCachedContent(
  surface: string,
  data: Array<Record<string, unknown>>
): void {
  sanityContentCache.set(surface, {
    data,
    expiresAt: Date.now() + SANITY_CACHE_TTL,
  });
}

/**
 * Recursively walks Sanity data and resolves audience-enabled fields
 * ({ _type: "audience*", default: ..., segments: [...] }) to their flat `.default` value.
 * This ensures the storefront never receives raw {_type, default, segments, active} objects.
 */
export function resolveAudienceFields<T>(data: T): T {
  if (isAudienceObject(data)) {
    return data.default as T;
  }
  if (Array.isArray(data)) {
    return data.map(resolveAudienceFields) as unknown as T;
  }
  if (typeof data === 'object' && data !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      resolved[key] = resolveAudienceFields(value);
    }
    return resolved as T;
  }
  return data;
}

function isAudienceObject(
  value: unknown
): value is { _type: string; default: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj._type === 'string' &&
    obj._type.startsWith('audience') &&
    'default' in obj
  );
}

/**
 * Fetches Sanity documents for personalization scoring for a given surface.
 * Uses parameterized GROQ (no string interpolation of user-controlled values).
 * Resolves all audience-enabled fields to flat values at the query level.
 */
export async function fetchAvailableContent(
  surface: string
): Promise<Array<Record<string, unknown>>> {
  const components = getComponentsForSurface(surface);
  const contentTypes = [...new Set(components.flatMap((c) => c.contentTypes))];
  if (contentTypes.length === 0) {
    return [];
  }

  const query = `*[_type in $contentTypes && (surface == $surface || !defined(surface))] {
      _id,
      _type,
      "title": coalesce(title.default, title, ""),
      "headline": coalesce(headline.default, headline, title, ""),
      "imageUrl": coalesce(image.default.asset->url, image.asset->url, ""),
      "badge": coalesce(badge.default, badge, ""),
      "subheadline": coalesce(subheadline.default, subheadline, ""),
      "backgroundColor": coalesce(backgroundColor.default, backgroundColor, ""),
      cta,
      "eyebrow": coalesce(eyebrow.default, eyebrow, ""),
      "description": coalesce(description.default, description, ""),
      buttons,
      secondaryBanners[] {
        "title": coalesce(title.default, title, ""),
        "description": coalesce(description.default, description, ""),
        "showPoweredBy": coalesce(showPoweredBy, false),
        "imageUrl": coalesce(image.default.asset->url, image.asset->url, ""),
        button {
          label,
          href,
          openInNewTab
        }
      },
      showPoweredBy
    }`;

  const cached = getCachedContent(surface);
  if (cached) {
    return cached;
  }

  try {
    const result = await sanityClient.fetch(query, {
      contentTypes,
      surface,
    });
    const data = (result as Array<Record<string, unknown>>) ?? [];
    setCachedContent(surface, data);
    return data;
  } catch (error) {
    logger.error({ err: error }, 'Sanity fetch failed');
    return [];
  }
}
