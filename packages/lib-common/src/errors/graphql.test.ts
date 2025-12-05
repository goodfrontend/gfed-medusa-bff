import { describe, it, expect } from 'vitest';
import {
  GraphQLError,
  MedusaServiceError,
  GraphQLValidationError,
  GraphQLNotFoundError,
  GraphQLServiceUnavailableError,
  handleMedusaError,
  createFieldPath,
} from './graphql.js';

describe('GraphQL Error Classes', () => {
  describe('GraphQLError', () => {
    it('should create error with message', () => {
      const error = new GraphQLError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('GraphQLError');
      expect(error.locations).toBeUndefined();
      expect(error.path).toBeUndefined();
      expect(error.extensions).toBeUndefined();
    });

    it('should create error with all options', () => {
      const error = new GraphQLError('Test error', {
        locations: [{ line: 1, column: 5 }],
        path: ['user', 'name'],
        extensions: {
          code: 'TEST_ERROR',
          customField: 'value',
        },
      });

      expect(error.message).toBe('Test error');
      expect(error.locations).toEqual([{ line: 1, column: 5 }]);
      expect(error.path).toEqual(['user', 'name']);
      expect(error.extensions).toEqual({
        code: 'TEST_ERROR',
        customField: 'value',
      });
    });

    it('should serialize to JSON correctly', () => {
      const error = new GraphQLError('Test error', {
        path: ['products', 0],
        extensions: { code: 'TEST_ERROR' },
      });

      const json = error.toJSON();

      expect(json).toEqual({
        message: 'Test error',
        path: ['products', 0],
        extensions: { code: 'TEST_ERROR' },
      });
    });

    it('should not include undefined fields in JSON', () => {
      const error = new GraphQLError('Test error');
      const json = error.toJSON();

      expect(json).toEqual({
        message: 'Test error',
      });
      expect(json.locations).toBeUndefined();
      expect(json.path).toBeUndefined();
    });
  });

  describe('MedusaServiceError', () => {
    it('should create Medusa service error', () => {
      const error = new MedusaServiceError(
        'Failed to fetch data',
        'MEDUSA_API_ERROR'
      );

      expect(error.message).toBe('Failed to fetch data');
      expect(error.extensions?.code).toBe('MEDUSA_API_ERROR');
    });

    it('should include original error stack trace', () => {
      const originalError = new Error('API error');
      const error = new MedusaServiceError(
        'Failed to fetch data',
        'MEDUSA_API_ERROR',
        originalError
      );

      expect(error.extensions?.exception?.stacktrace).toBeDefined();
      expect(Array.isArray(error.extensions?.exception?.stacktrace)).toBe(true);
    });

    it('should include path when provided', () => {
      const error = new MedusaServiceError(
        'Failed to fetch data',
        'MEDUSA_API_ERROR',
        undefined,
        ['products', 0]
      );

      expect(error.path).toEqual(['products', 0]);
    });
  });

  describe('GraphQLValidationError', () => {
    it('should create validation error', () => {
      const error = new GraphQLValidationError('Invalid email format');

      expect(error.message).toBe('Invalid email format');
      expect(error.extensions?.code).toBe('VALIDATION_ERROR');
    });

    it('should include path', () => {
      const error = new GraphQLValidationError('Invalid email format', [
        'user',
        'email',
      ]);

      expect(error.path).toEqual(['user', 'email']);
    });
  });

  describe('GraphQLNotFoundError', () => {
    it('should create not found error without id', () => {
      const error = new GraphQLNotFoundError('Product');

      expect(error.message).toBe('Product not found');
      expect(error.extensions?.code).toBe('NOT_FOUND');
    });

    it('should create not found error with id', () => {
      const error = new GraphQLNotFoundError('Product', 'prod_123');

      expect(error.message).toBe('Product with id "prod_123" not found');
      expect(error.extensions?.code).toBe('NOT_FOUND');
    });

    it('should include path', () => {
      const error = new GraphQLNotFoundError('Product', 'prod_123', [
        'product',
      ]);

      expect(error.path).toEqual(['product']);
    });
  });

  describe('GraphQLServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new GraphQLServiceUnavailableError('Medusa');

      expect(error.message).toBe('Medusa service is currently unavailable');
      expect(error.extensions?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should include path', () => {
      const error = new GraphQLServiceUnavailableError('Medusa', ['products']);

      expect(error.path).toEqual(['products']);
    });
  });

  describe('handleMedusaError', () => {
    it('should throw GraphQLNotFoundError for 404', () => {
      const apiError = new Error('Resource not found');

      expect(() => handleMedusaError(apiError, 'fetch product')).toThrow(
        GraphQLNotFoundError
      );
    });

    it('should throw GraphQLNotFoundError for "not found" message', () => {
      const apiError = new Error('Product not found in database');

      expect(() => handleMedusaError(apiError, 'fetch product')).toThrow(
        GraphQLNotFoundError
      );
    });

    it('should throw GraphQLValidationError for validation errors', () => {
      const apiError = new Error('Validation failed: invalid email');

      expect(() => handleMedusaError(apiError, 'create user')).toThrow(
        GraphQLValidationError
      );
    });

    it('should throw GraphQLValidationError for invalid messages', () => {
      const apiError = new Error('Invalid product ID format');

      expect(() => handleMedusaError(apiError, 'fetch product')).toThrow(
        GraphQLValidationError
      );
    });

    it('should throw GraphQLServiceUnavailableError for network errors', () => {
      const apiError = new Error('Network error: connection timeout');

      expect(() => handleMedusaError(apiError, 'fetch products')).toThrow(
        GraphQLServiceUnavailableError
      );
    });

    it('should throw GraphQLServiceUnavailableError for timeout', () => {
      const apiError = new Error('Request timeout');

      expect(() => handleMedusaError(apiError, 'fetch products')).toThrow(
        GraphQLServiceUnavailableError
      );
    });

    it('should throw GraphQLServiceUnavailableError for 503', () => {
      const apiError = new Error('503 Service Unavailable');

      expect(() => handleMedusaError(apiError, 'fetch products')).toThrow(
        GraphQLServiceUnavailableError
      );
    });

    it('should throw MedusaServiceError for generic errors', () => {
      const apiError = new Error('Something went wrong');

      expect(() => handleMedusaError(apiError, 'fetch products')).toThrow(
        MedusaServiceError
      );

      try {
        handleMedusaError(apiError, 'fetch products');
      } catch (error) {
        expect(error).toBeInstanceOf(MedusaServiceError);
        if (error instanceof MedusaServiceError) {
          expect(error.message).toContain('Failed to fetch products');
          expect(error.extensions?.code).toBe('MEDUSA_API_ERROR');
        }
      }
    });

    it('should throw MedusaServiceError for non-Error objects', () => {
      expect(() => handleMedusaError('string error', 'fetch products')).toThrow(
        MedusaServiceError
      );

      try {
        handleMedusaError('string error', 'fetch products');
      } catch (error) {
        if (error instanceof MedusaServiceError) {
          expect(error.message).toContain('Unknown error occurred');
          expect(error.extensions?.code).toBe('UNKNOWN_ERROR');
        }
      }
    });

    it('should include path in thrown errors', () => {
      const apiError = new Error('Not found');
      const path = ['products', 0, 'name'];

      try {
        handleMedusaError(apiError, 'fetch product', path);
      } catch (error) {
        if (error instanceof GraphQLNotFoundError) {
          expect(error.path).toEqual(path);
        }
      }
    });
  });

  describe('createFieldPath', () => {
    it('should create path from field name', () => {
      const path = createFieldPath(undefined, 'products');

      expect(path).toEqual(['products']);
    });

    it('should append to parent path', () => {
      const path = createFieldPath(['user'], 'email');

      expect(path).toEqual(['user', 'email']);
    });

    it('should include index when provided', () => {
      const path = createFieldPath(['products'], 'title', 0);

      expect(path).toEqual(['products', 'title', 0]);
    });

    it('should handle empty parent path', () => {
      const path = createFieldPath([], 'field');

      expect(path).toEqual(['field']);
    });
  });
});
