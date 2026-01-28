export const queryResolvers = {
  Query: {
    deploymentInfoOrders: () => ({
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      message: 'Orders subgraph - Initial production release v1.0.0',
      deployedAt: new Date().toISOString(),
      buildNumber: process.env.BUILD_NUMBER || 'local',
      nodeVersion: process.version,
    }),
  },
};
