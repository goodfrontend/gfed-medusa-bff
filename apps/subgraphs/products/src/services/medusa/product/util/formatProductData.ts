import type { Product } from '@graphql/generated/graphql';
import { HttpTypes } from '@medusajs/types';

export const formatProductData = (
  product?: HttpTypes.StoreProduct
): Product | null => {
  if (!product) return null;

  const {
    id: productId,
    title,
    handle,
    description,
    thumbnail,
    variants,
    options,
    images,
    material,
    origin_country: originCountry,
    type,
    weight,
    width,
    height,
    length,
    collection,
    collection_id: collectionId,
    tags,
    created_at: createdAt,
  } = product;

  const formattedVariants = variants?.map((variant) => {
    const {
      id: variantId,
      sku,
      options: variantOptions,
      manage_inventory: manageInventory,
      allow_backorder: allowBackorder,
      inventory_quantity: inventoryQuantity,
      calculated_price: calculatedPrice,
      product_id: productId,
    } = variant;

    return {
      id: variantId,
      productId,
      sku,
      options:
        variantOptions?.map(({ id, option_id, value }) => ({
          id,
          optionId: option_id || '',
          value,
        })) || [],
      manageInventory: !!manageInventory,
      allowBackorder: !!allowBackorder,
      inventoryQuantity,
      ...(calculatedPrice && {
        price: {
          currencyCode: calculatedPrice?.currency_code,
          amount: calculatedPrice?.calculated_amount,
          priceType:
            calculatedPrice?.calculated_price?.price_list_type || 'default',
        },
        originalPrice: {
          currencyCode: calculatedPrice?.currency_code,
          amount: calculatedPrice?.original_amount,
          priceType:
            calculatedPrice?.original_price?.price_list_type || 'default',
        },
      }),
    } as unknown as Product['variants'][number];
  });

  return {
    id: productId,
    title,
    handle,
    description,
    thumbnail,
    material,
    originCountry,
    type: type?.id,
    weight,
    length,
    width,
    height,
    collectionId,
    createdAt: createdAt ?? new Date().toISOString(),
    tags: tags?.map(({ id }) => ({ id })),
    collection: collection
      ? {
          id: collection?.id,
          title: collection?.title,
          handle: collection?.handle,
        }
      : null,
    variants: formattedVariants,
    options: options?.map(({ id, title, values }) => ({
      id,
      title,
      values:
        values?.map(({ id: valueId, value }) => ({
          id: valueId,
          value,
        })) || [],
    })),
    images: images?.map(({ id, url }) => ({
      id,
      url,
    })),
  };
};
