export const queryResolvers = {
  Query: {
    deploymentInfoContent: () => ({
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      message: 'Content subgraph - Initial production release v1.0.0',
      deployedAt: new Date().toISOString(),
    }),
  },
};
