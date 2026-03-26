import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { z } from 'zod'
import { config } from './env.js'
import { logger } from './logger/logger.js'
import { RealtimeSession } from './session/realtimeSession.js'
import './function-calling/toolRegistry.js' // ツール自動登録

const sessionRequestSchema = z.object({
  sdp: z.string(),
  clientTools: z
    .array(
      z.object({
        type: z.literal('function'),
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.string(), z.unknown()),
      })
    )
    .default([]),
})

const app = express()
app.use(cors())
app.use(express.json())

// ヘルスチェック用エンドポイント
app.get('/', (_req, res) =>
  res.json({ message: 'Pizza Concierge API', env: config.env })
)

// セッション開始エンドポイント
app.post('/session', async (req, res) => {
  try {
    if (!config.openaiApiKey)
      return res.status(500).json({ error: 'Server misconfigured' })

    const { sdp, clientTools } = sessionRequestSchema.parse(req.body)
    const session = new RealtimeSession({
      sdp,
      openaiApiKey: config.openaiApiKey,
      clientTools,
    })
    const result = await session.connect()

    logger.info('Session created, callId=' + result.callId)
    return res.json({ sdp: result.sdp })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    logger.error('Failed to create session: ' + message)
    return res
      .status(502)
      .json({ error: 'Failed to connect to Realtime API' })
  }
})

app.listen(config.apiPort, () =>
  logger.info(`Pizza Concierge API running on :${config.apiPort}`)
)
