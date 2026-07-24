export const adkConfig = {
  agentUrl: (): string => process.env.ADK_AGENT_URL || 'http://localhost:3100',
  agentEndpoint: (): string => `${adkConfig.agentUrl()}/agent/personalize`,
  enabled: (): boolean => process.env.ADK_ENABLED === 'true',
  cacheTtl: (): number => parseInt(process.env.ADK_CACHE_TTL || '300', 10),
  timeoutMs: (): number =>
    parseInt(process.env.ADK_AGENT_TIMEOUT || '25000', 10),
  agentMode: (): string => process.env.ADK_AGENT_MODE || 'local',
  engineId: (): string => process.env.ADK_ENGINE_ID || '',
  getLocation: (): string => process.env.ADK_GCP_LOCATION || '',
  getEngineName: (): string => {
    const id = process.env.ADK_ENGINE_ID || '';
    const projectNumber = process.env.ADK_GCP_PROJECT_NUMBER || '';
    if (!id || !projectNumber) return '';
    return `projects/${projectNumber}/locations/${adkConfig.getLocation()}/reasoningEngines/${id}`;
  },

  pubsub: {
    topicName: (): string => process.env.ADK_PUBSUB_TOPIC || 'signal-raw',
    projectId: (): string => process.env.ADK_GCP_PROJECT_ID || '',
  },
};
