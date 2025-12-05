/**
 * GraphQL-specific error classes for use in Apollo Server resolvers
 * These errors include the `path` field and follow GraphQL error format
 */

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

export interface GraphQLErrorExtensions {
  code?: string;
  exception?: {
    stacktrace?: string[];
  };
  [key: string]: unknown;
}

export interface GraphQLFormattedError {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: (string | number)[];
  extensions?: GraphQLErrorExtensions;
}

/**
 * Base class for GraphQL errors
 * Use this when throwing errors in GraphQL resolvers
 */
export class GraphQLError extends Error {
  public readonly locations?: GraphQLErrorLocation[];
  public readonly path?: (string | number)[];
  public readonly extensions?: GraphQLErrorExtensions;

  constructor(
    message: string,
    options?: {
      locations?: GraphQLErrorLocation[];
      path?: (string | number)[];
      extensions?: GraphQLErrorExtensions;
    }
  ) {
    super(message);
    this.name = 'GraphQLError';
    this.locations = options?.locations;
    this.path = options?.path;
    this.extensions = options?.extensions;
  }

  toJSON(): GraphQLFormattedError {
    return {
      message: this.message,
      ...(this.locations && { locations: this.locations }),
      ...(this.path && { path: this.path }),
      ...(this.extensions && { extensions: this.extensions }),
    };
  }
}

/**
 * Error for Medusa API/service failures
 */
export class MedusaServiceError extends GraphQLError {
  constructor(
    message: string,
    code: string,
    originalError?: Error,
    path?: (string | number)[]
  ) {
    super(message, {
      extensions: {
        code,
        ...(originalError && {
          exception: {
            stacktrace: originalError.stack?.split('\n'),
          },
        }),
      },
      path,
    });
  }
}

/**
 * Validation error (400)
 */
export class GraphQLValidationError extends GraphQLError {
  constructor(message: string, path?: (string | number)[]) {
    super(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
      },
      path,
    });
  }
}

/**
 * Not found error (404)
 */
export class GraphQLNotFoundError extends GraphQLError {
  constructor(resource: string, id?: string, path?: (string | number)[]) {
    const message = id
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;

    super(message, {
      extensions: {
        code: 'NOT_FOUND',
      },
      path,
    });
  }
}

/**
 * Service unavailable error (503)
 */
export class GraphQLServiceUnavailableError extends GraphQLError {
  constructor(service: string, path?: (string | number)[]) {
    super(`${service} service is currently unavailable`, {
      extensions: {
        code: 'SERVICE_UNAVAILABLE',
      },
      path,
    });
  }
}

/**
 * Helper function to handle Medusa API errors and convert them to GraphQL errors
 */
export function handleMedusaError(
  error: unknown,
  operation: string,
  path?: (string | number)[]
): never {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new GraphQLNotFoundError(operation, undefined, path);
    }

    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')
    ) {
      throw new GraphQLValidationError(error.message, path);
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('503') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')
    ) {
      throw new GraphQLServiceUnavailableError('Medusa', path);
    }

    throw new MedusaServiceError(
      `Failed to ${operation}: ${error.message}`,
      'MEDUSA_API_ERROR',
      error,
      path
    );
  }

  throw new MedusaServiceError(
    `Unknown error occurred during ${operation}`,
    'UNKNOWN_ERROR',
    undefined,
    path
  );
}

/**
 * Helper to create field paths for nested GraphQL errors
 */
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
