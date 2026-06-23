export const config = {
  port: parseInt(process.env['PORT'] ?? '4009', 10),
  corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
  serviceName: process.env['SERVICE_NAME'] ?? 'mock-personalization',
  serviceVersion: '0.1.0',
};
