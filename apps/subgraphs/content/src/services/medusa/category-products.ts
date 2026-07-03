import { getMedusaClient } from './index';

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

export async function fetchCategoryProducts(handle: string): Promise<ProductPreview[]> {
  const medusa = getMedusaClient();

  const { product_categories } = await medusa.store.category.list({
    handle,
    limit: 1,
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
    fields: 'id,title,handle,thumbnail,variants.calculated_price',
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
