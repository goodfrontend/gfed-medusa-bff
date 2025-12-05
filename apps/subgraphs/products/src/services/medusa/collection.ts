import type { Collection } from '@graphql/generated/graphql';
import type { HttpTypes } from '@medusajs/types';

import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { MedusaBaseService } from '.';
import { COLLECTION_FIELDS } from '../../constants/medusa';

export class CollectionService extends MedusaBaseService {
  async getCollections(
    params?: HttpTypes.FindParams & HttpTypes.StoreCollectionFilters
  ): Promise<Collection[]> {
    try {
      const { collections } = await this.medusa.store.collection.list({
        ...params,
        fields: COLLECTION_FIELDS,
      });

      return collections?.map(({ id, title, handle }) => ({
        id,
        title,
        handle,
      }));
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch collections', ['collections']);
    }
  }

  async getCollection(id: string): Promise<Collection | null> {
    try {
      const { collection } = await this.medusa.store.collection.retrieve(id, {
        fields: COLLECTION_FIELDS,
      });
      if (!collection) return null;

      const { id: collectionId, title, handle } = collection;

      return { id: collectionId, title, handle };
    } catch (error: unknown) {
      handleMedusaError(error, 'fetch collection', ['collection']);
    }
  }
}
