import type { FunctionTool } from '../function-calling/types.js'

export type RealtimeAPISessionConfig = {
  type: 'realtime'
  model?: string
  audio?: {
    input?: {
      noise_reduction?: { type: string }
      transcription?: {
        model: string
        language?: string
        prompt?: string
      }
    }
    output?: { voice?: string }
  }
  instructions?: string
  tools?: FunctionTool[]
  [key: string]: unknown
}

export type CallApiResult = { callId: string; sdp: string }

/**
 * OpenAI Realtime API とのセッション確立を行うクライアント
 * 1. createEphemeralKey() で一時認証キーを取得
 * 2. postCallAPI() で WebRTC の SDP 交換を行い callId を取得
 */
export class RealtimeApiClient {
  constructor(
    private readonly sdp: string,
    private readonly sessionConfig: RealtimeAPISessionConfig,
    private readonly openaiApiKey: string
  ) {}

  async createEphemeralKey(): Promise<string> {
    const res = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session: this.sessionConfig }),
      }
    )
    if (!res.ok)
      throw new Error(
        `client_secrets API error (${res.status}): ${await res.text()}`
      )
    return ((await res.json()) as { value: string }).value
  }

  async postCallAPI(ephemeralKey: string): Promise<CallApiResult> {
    const res = await fetch(
      'https://api.openai.com/v1/realtime/calls',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: this.sdp,
      }
    )
    if (!res.ok)
      throw new Error(
        `calls API error (${res.status}): ${await res.text()}`
      )

    const callId = res.headers.get('Location')?.split('/').pop()
    if (!callId) throw new Error('calls API error: missing callId')
    return { callId, sdp: await res.text() }
  }
}
