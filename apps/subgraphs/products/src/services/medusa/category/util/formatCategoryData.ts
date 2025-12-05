import { ProductCategory } from '@graphql/generated/graphql';
import { HttpTypes } from '@medusajs/types';

export const formatCategoryData = (
  category: HttpTypes.StoreProductCategory
): ProductCategory => ({
  id: category.id,
  description: category.description,
  name: category.name,
  handle: category.handle,
  parentCategory: category.parent_category
    ? formatCategoryData(category.parent_category)
    : null,
  categoryChildren: category.category_children?.map(formatCategoryData) || null,
});
