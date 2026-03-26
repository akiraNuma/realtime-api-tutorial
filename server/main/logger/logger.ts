import pino from 'pino'
import { config } from '../env.js'

export const logger = pino({
  level:
    process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug'),
  ...(!config.isProduction && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
})
