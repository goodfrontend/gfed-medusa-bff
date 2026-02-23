export const baseTypeDefs = `
  schema @link(url: "https://specs.apollographql.com/federation/v2.3", import: ["@key", "@external", "@requires", "@provides", "@tag", "@shareable"]) {
    query: Query
  }

  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
  ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

  type Query {
    _empty: String
  }
`;
