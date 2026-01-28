export const queryResolvers = {
  Query: {
    deploymentInfoContent: () => ({
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      message: 'Content subgraph deployed',
      deployedAt: new Date().toISOString(),
    }),
  },
};
