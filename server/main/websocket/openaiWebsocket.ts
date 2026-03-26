import WebSocket from 'ws'
import { executeFunction } from '../function-calling/toolRegistry.js'
import { logger } from '../logger/logger.js'

type FunctionCallItem = {
  type: 'function_call'
  call_id: string
  name: string
  arguments: string
}
type ServerEvent = {
  type: string
  item?: {
    type: string
    call_id?: string
    name?: string
    arguments?: string
  }
}

/**
 * OpenAI Realtime API へのサーバーサイド WebSocket 接続
 * function_call イベントを受信 → サーバーツールを実行 → 結果を返却
 */
export class OpenAIWebSocketConnector {
  private readonly url: string
  private ws: WebSocket | null = null

  constructor(
    callId: string,
    private readonly ephemeralKey: string,
    private readonly clientToolNames: Set<string> = new Set(),
    private readonly options: { onClose?: () => void } = {}
  ) {
    this.url = 'wss://api.openai.com/v1/realtime?call_id=' + callId
  }

  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, {
        headers: { Authorization: 'Bearer ' + this.ephemeralKey },
      })
      this.ws = ws

      let settled = false
      const settle = <T>(fn: (v?: T) => void, v?: T) => {
        if (!settled) {
          settled = true
          fn(v)
        }
      }

      ws.once('open', () => {
        logger.debug('WebSocket connected.')
        settle(resolve)
      })
      ws.once('close', (code, reason) => {
        logger.info(`WebSocket closed: ${code} ${reason}`)
        this.ws = null
        if (!settled && code !== 1000)
          settle(reject, new Error(`WebSocket closed: ${code}`))
        this.options.onClose?.()
      })
      ws.once('error', e => {
        logger.error(`WebSocket error: ${e.message}`)
        settle(reject, e)
      })

      ws.on('message', raw => {
        try {
          const event: ServerEvent = JSON.parse(raw.toString())
          if (
            event.type !== 'response.output_item.done' ||
            event.item?.type !== 'function_call'
          )
            return

          const {
            call_id,
            name,
            arguments: args,
          } = event.item as FunctionCallItem
          logger.info(`Function call(${call_id}): ${name}(${args})`)

          if (this.clientToolNames.has(name)) return // クライアント側ツールはスルー

          void executeFunction(name, JSON.parse(args), result => {
            if (!this.ws) return
            logger.debug(`Function result: ${JSON.stringify(result)}`)
            this.ws.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id,
                  output: JSON.stringify(result),
                },
              })
            )
            this.ws.send(JSON.stringify({ type: 'response.create' }))
          })
        } catch (e) {
          logger.error('Error processing WebSocket message: ' + e)
        }
      })
    })
  }

  /** WebSocket 接続を明示的に閉じる */
  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
