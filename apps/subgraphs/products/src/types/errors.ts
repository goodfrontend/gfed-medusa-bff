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

export class ValidationError extends GraphQLError {
  constructor(message: string, path?: (string | number)[]) {
    super(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
      },
      path,
    });
  }
}

export class NotFoundError extends GraphQLError {
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

export class ServiceUnavailableError extends GraphQLError {
  constructor(service: string, path?: (string | number)[]) {
    super(`${service} service is currently unavailable`, {
      extensions: {
        code: 'SERVICE_UNAVAILABLE',
      },
      path,
    });
  }
}