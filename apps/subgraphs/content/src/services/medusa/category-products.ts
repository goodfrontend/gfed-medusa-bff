import { getMedusaClient } from './index';

export interface ProductPreview {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
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

  const categoryId = product_categories[0].id;

  const { products } = await medusa.store.product.list({
    category_id: [categoryId],
    limit: 3,
    order: '-created_at',
    is_giftcard: false,
    fields: 'id,title,handle,thumbnail',
  });

  return products.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail || '',
  }));
}
