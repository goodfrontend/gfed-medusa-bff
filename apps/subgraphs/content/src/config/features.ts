export const features = {
  aiEnabled: (): boolean => process.env.AI_ENABLED === 'true',
  aiProviderUrl: (): string =>
    (process.env.AI_PROVIDER_URL || 'http://localhost:11434/v1').replace(
      /\/$/,
      ''
    ),
  aiModel: (): string => process.env.AI_MODEL || 'llama3.2:3b',
  aiApiKey: (): string => process.env.AI_API_KEY || '',
  aiTemperature: (): number => parseFloat(process.env.AI_TEMPERATURE || '0'),
  aiJsonMode: (): boolean => process.env.AI_JSON_MODE !== 'false',
  aiMaxTokens: (): number => parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
  aiGeminiApiKey: (): string => process.env.AI_GEMINI_API_KEY || '',
  aiGeminiModel: (): string => process.env.AI_GEMINI_MODEL || 'gemini-2.0-flash',
};
