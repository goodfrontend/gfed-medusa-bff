import { logger } from '../logger';
import { getMedusaClient } from './index';

export interface ProductPreviewEnriched extends ProductPreview {
  price: number | null;
  currencyCode: string | null;
  description: string;
}

export interface ProductPreview {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
  price?: number;
  currencyCode?: string;
}

export interface CategoryOption {
  handle: string;
  name: string;
  score: number;
}

function medusaTimeout(durationMs: number): Promise<never> {
  return new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Medusa API timed out after ${durationMs}ms`));
    }, durationMs);
  });
}

export async function fetchCategoryProducts(
  handle: string
): Promise<ProductPreview[]> {
  const medusa = getMedusaClient();

  const TIME_MS = 10_000;

  const { product_categories } = await Promise.race([
    medusa.store.category.list({
      handle,
      limit: 1,
    }),
    medusaTimeout(TIME_MS),
  ]).catch((err) => {
    logger.warn(
      { err, handle },
      'Medusa category list fetch failed or timed out'
    );
    throw err;
  });

  if (!product_categories?.length) return [];

  const firstCategory = product_categories[0];
  if (!firstCategory) return [];

  const categoryId = firstCategory.id;

  const { products } = await medusa.store.product.list({
    category_id: [categoryId],
    limit: 3,
    order: '-created_at',
    is_giftcard: false,
    fields: 'id,title,handle,thumbnail',
  });

  return products.map((p) => {
    const firstVariant = p.variants?.[0];
    const calculatedPrice = firstVariant?.calculated_price as Record<string, unknown> | undefined;
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail || '',
      price: (calculatedPrice?.calculated_amount as number) ?? undefined,
      currencyCode: (calculatedPrice?.currency_code as string) ?? undefined,
    };
  });
}

export async function fetchCategoryProductsEnriched(
  handle: string
): Promise<ProductPreviewEnriched[]> {
  const medusa = getMedusaClient();

  const TIME_MS = 10_000;

  const { product_categories } = await Promise.race([
    medusa.store.category.list({
      handle,
      limit: 1,
    }),
    medusaTimeout(TIME_MS),
  ]).catch((err) => {
    logger.warn(
      { err, handle },
      'Medusa category list fetch failed or timed out'
    );
    throw err;
  });

  if (!product_categories?.length) return [];

  const firstCategory = product_categories[0];
  if (!firstCategory) return [];

  const categoryId = firstCategory.id;

  const { products } = await Promise.race([
    medusa.store.product.list({
      category_id: [categoryId],
      limit: 8,
      order: '-created_at',
      is_giftcard: false,
      fields:
        'id,title,handle,thumbnail,description,variants.prices.amount,variants.prices.currency_code',
    }),
    medusaTimeout(TIME_MS),
  ]).catch((err) => {
    logger.warn(
      { err, categoryId },
      'Medusa product list fetch failed or timed out'
    );
    throw err;
  });

  return products.map((p) => {
    const pRecord = p as unknown as Record<string, unknown>;
    const firstVariantPrice = pRecord.variants as
      | Array<{ prices?: Array<{ amount?: number; currency_code?: string }> }>
      | undefined;

    const price = firstVariantPrice?.[0]?.prices?.[0]?.amount ?? null;
    const currencyCode =
      firstVariantPrice?.[0]?.prices?.[0]?.currency_code ?? null;

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail || '',
      price,
      currencyCode,
      description: (pRecord.description as string) ?? '',
    };
  });
}

export async function fetchCategoryProductsEnriched(
  handle: string
): Promise<ProductPreviewEnriched[]> {
  const medusa = getMedusaClient();

  const TIME_MS = 10_000;

  const { product_categories } = await Promise.race([
    medusa.store.category.list({
      handle,
      limit: 1,
    }),
    medusaTimeout(TIME_MS),
  ]).catch((err) => {
    logger.warn(
      { err, handle },
      'Medusa category list fetch failed or timed out'
    );
    throw err;
  });

  if (!product_categories?.length) return [];

  const firstCategory = product_categories[0];
  if (!firstCategory) return [];

  const categoryId = firstCategory.id;

  const { products } = await Promise.race([
    medusa.store.product.list({
      category_id: [categoryId],
      limit: 8,
      order: '-created_at',
      is_giftcard: false,
      fields:
        'id,title,handle,thumbnail,description,variants.prices.amount,variants.prices.currency_code',
    }),
    medusaTimeout(TIME_MS),
  ]).catch((err) => {
    logger.warn(
      { err, categoryId },
      'Medusa product list fetch failed or timed out'
    );
    throw err;
  });

  return products.map((p) => {
    const pRecord = p as unknown as Record<string, unknown>;
    const firstVariantPrice = pRecord.variants as
      | Array<{ prices?: Array<{ amount?: number; currency_code?: string }> }>
      | undefined;

    const price = firstVariantPrice?.[0]?.prices?.[0]?.amount ?? null;
    const currencyCode =
      firstVariantPrice?.[0]?.prices?.[0]?.currency_code ?? null;

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail || '',
      price,
      currencyCode,
      description: (pRecord.description as string) ?? '',
    };
  });
}
