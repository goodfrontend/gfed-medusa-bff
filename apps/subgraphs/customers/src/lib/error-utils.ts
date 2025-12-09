import {
  MedusaServiceError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../types/errors';

// TODO: delete `lib` folder. we should be using `lib` from `@gfed-medusa/bff-lib-common` once its ready
export function handleMedusaError(
  error: unknown,
  operation: string,
  path?: (string | number)[]
): never {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new NotFoundError(operation, undefined, path);
    }

    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')
    ) {
      throw new ValidationError(error.message, path);
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('503')
    ) {
      throw new ServiceUnavailableError('Medusa', path);
    }

    throw new MedusaServiceError(
      `Failed to ${operation}: ${error.message}`,
      'MEDUSA_API_ERROR',
      error,
      path
    );
  }

  throw new MedusaServiceError(
    `Unknown error occurred during ${operation}: ${JSON.stringify(error)}`,
    'UNKNOWN_ERROR',
    undefined,
    path
  );
}

export function createFieldPath(
  parentPath: (string | number)[] | undefined,
  fieldName: string,
  index?: number
): (string | number)[] {
  const basePath = parentPath || [];
  if (index !== undefined) {
    return [...basePath, fieldName, index];
  }
  return [...basePath, fieldName];
}
