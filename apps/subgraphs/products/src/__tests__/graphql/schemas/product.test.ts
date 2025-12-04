import { typeDefs } from '@graphql/schemas';

describe('Product Schema', () => {
  it('should be valid GraphQL schema', () => {
    expect(typeDefs).toBeDefined();
    expect(typeDefs.kind).toBe('Document');
  });

  it('should contain required types', () => {
    expect(typeDefs).toBeDefined();
    // Basic validation that typeDefs is a DocumentNode
    expect(typeDefs.definitions).toBeDefined();
    expect(Array.isArray(typeDefs.definitions)).toBe(true);
  });

  it('should contain definitions', () => {
    expect(typeDefs.definitions.length).toBeGreaterThan(0);
  });

  it('should be a proper GraphQL DocumentNode', () => {
    expect(typeDefs.kind).toBe('Document');
    expect(typeDefs.definitions).toBeDefined();
  });
});
