import Medusa from '@medusajs/js-sdk';

export class MedusaBaseService {
  protected medusa: Medusa;

  constructor(medusaInstance: Medusa) {
    this.medusa = medusaInstance;
  }
}
