/**
 * クライアント側 Function Tool の型定義
 */
export type ClientFunctionTool = {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * 会話ログ
 */
export type ConversationLogEntry = {
  id: string
  timestamp: Date
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * ツール実行ログ
 */
export type ToolCallLogEntry = {
  callId: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  source: 'client' | 'server'
  timestamp: Date
}
