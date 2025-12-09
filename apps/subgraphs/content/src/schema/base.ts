export const baseTypeDefs = `
  schema @link(url: "https://specs.apollographql.com/federation/v2.3", import: ["@key", "@external", "@requires", "@provides", "@tag", "@shareable"]) {
    query: Query
  }

  type Query {
    _empty: String
  }
`;
