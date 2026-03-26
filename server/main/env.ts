import 'dotenv/config'

const NODE_ENV = process.env.NODE_ENV ?? 'development'

export const config = {
  env: NODE_ENV,
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  apiPort: process.env.API_PORT || 9876,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
} as const
