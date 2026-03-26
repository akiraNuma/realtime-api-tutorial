import { getRegisteredServerTools } from '../function-calling/toolRegistry.js'
import type { FunctionTool } from '../function-calling/types.js'
import {
  RealtimeApiClient,
  type CallApiResult,
  type RealtimeAPISessionConfig,
} from '../api/realtimeApiClient.js'
import { OpenAIWebSocketConnector } from '../websocket/openaiWebsocket.js'
import { logger } from '../logger/logger.js'
import fs from 'fs'
import path from 'path'

const readSystemPrompt = (): string => {
  const file = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    './instructions.md'
  )
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/**
 * セッション単位で Realtime API 接続を管理するクラス
 * 1セッション = 1WebRTC接続 + 1WebSocket接続（サーバーサイド制御用）
 */
export class RealtimeSession {
  private readonly apiClient: RealtimeApiClient
  private readonly clientToolNames: Set<string>
  private callId?: string
  private ephemeralKey?: string
  private wsConnector?: OpenAIWebSocketConnector

  constructor({
    sdp,
    openaiApiKey,
    clientTools = [],
  }: {
    sdp: string
    openaiApiKey: string
    clientTools?: FunctionTool[]
  }) {
    this.clientToolNames = new Set(clientTools.map(t => t.name))
    const serverTools = getRegisteredServerTools()

    const sessionConfig: RealtimeAPISessionConfig = {
      type: 'realtime',
      model: 'gpt-realtime-1.5',
      audio: {
        input: {
          noise_reduction: { type: 'near_field' },
          transcription: {
            model: 'gpt-4o-mini-transcribe',
            language: 'ja',
          },
        },
        output: { voice: 'shimmer' },
      },
      instructions: readSystemPrompt().trim(),
      tools: [...serverTools, ...clientTools],
    }
    this.apiClient = new RealtimeApiClient(
      sdp,
      sessionConfig,
      openaiApiKey
    )
  }

  /** Ephemeral Key 取得 → Call API → WebSocket 接続 */
  async connect(): Promise<CallApiResult> {
    this.ephemeralKey = await this.apiClient.createEphemeralKey()
    const callResult = await this.apiClient.postCallAPI(
      this.ephemeralKey
    )
    this.callId = callResult.callId

    this.wsConnector = new OpenAIWebSocketConnector(
      this.callId,
      this.ephemeralKey,
      this.clientToolNames,
      {
        onClose: () => logger.info('Session disposed.'),
      }
    )
    await this.wsConnector.connectWebSocket()
    return callResult
  }

  /** セッションを明示的に終了する（WebSocket を閉じる） */
  dispose(): void {
    this.wsConnector?.close()
  }
}
