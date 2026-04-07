import { ref, onUnmounted, type Ref } from 'vue'
import {
  clientToolDefinitions,
  executeClientTool,
  type ClientToolHandlers,
} from '../tools/clientTools'
import type { ToolCallLogEntry, ConversationLogEntry } from '../types'

/**
 * OpenAI Realtime API との WebRTC 接続を管理する Composable
 *
 * 通信フロー:
 *  1. マイク取得 → PeerConnection 作成 → Offer SDP 生成
 *  2. サーバー POST /session に SDP + クライアントツール定義を送信
 *  3. サーバーから Answer SDP を受け取り WebRTC 接続確立
 *  4. DataChannel 経由でイベント送受信（function_call 含む）
 */

/**
 * API のベース URL
 * - ローカル開発: Vite のプロキシ経由 → '/api'
 * - Docker / 外部: 環境変数 VITE_API_BASE_URL で指定可能
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function useRealtimeConnection(handlers: ClientToolHandlers) {
  // ── クライアントツール名（初期化時に1回だけ計算） ──
  const clientToolNames = new Set(
    clientToolDefinitions.map(t => t.name)
  )

  // ── 状態 ──
  const isConnected: Ref<boolean> = ref(false)
  const isConnecting: Ref<boolean> = ref(false)
  const isMicEnabled: Ref<boolean> = ref(true)
  const isAiThinking: Ref<boolean> = ref(false)
  const isAiSpeaking: Ref<boolean> = ref(false)
  const toolInProgress: Ref<string | null> = ref(null)
  const conversationLog: Ref<ConversationLogEntry[]> = ref([])
  const toolCallLog: Ref<ToolCallLogEntry[]> = ref([])
  const error: Ref<string | null> = ref(null)

  // ── ツール名 → 人間向け説明 ──
  const toolActivityLabels: Record<string, string> = {
    search_menu: 'メニューを取得中...',
    show_menu: 'メニューを表示中...',
    preview_pizza: 'ピザをプレビュー中...',
    place_order: '注文を処理中...',
    show_order_result: '注文結果を表示中...',
    show_notification: '通知を表示中...',
  }

  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let localMicStream: MediaStream | null = null
  let micUnmuteTimer: ReturnType<typeof setTimeout> | null = null
  const audioEl: HTMLAudioElement = new Audio()
  audioEl.autoplay = true

  /**
   * マイクトラックの有効/無効を切り替える（内部用）
   * ユーザーが手動でミュートしている場合は再有効化しない
   */
  function setMicTrackEnabled(enabled: boolean) {
    if (!localMicStream) return
    // ユーザーが手動ミュート中なら有効化しない
    if (enabled && !isMicEnabled.value) return
    localMicStream.getAudioTracks().forEach(track => {
      track.enabled = enabled
    })
  }

  // ── 接続 ──
  async function connect() {
    if (isConnecting.value || isConnected.value) return
    isConnecting.value = true
    error.value = null

    try {
      // 1. マイク取得
      // タブレット等でスピーカー音声をマイクが拾うのを防ぐため、
      // エコーキャンセル・ノイズ抑制・自動ゲイン制御を明示的に有効化
      localMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // 2. PeerConnection 作成
      pc = new RTCPeerConnection()

      // マイクトラックを追加
      localMicStream.getTracks().forEach(track => {
        pc!.addTrack(track, localMicStream!)
      })

      // リモート音声の受信設定
      pc.ontrack = event => {
        audioEl.srcObject = event.streams[0]
        // autoplay だけでは再生されないブラウザがあるため明示的に play() する
        audioEl
          .play()
          .catch(e => console.warn('[Audio] play() failed:', e))
      }

      // DataChannel 作成（OpenAI Realtime API イベント送受信用）
      dc = pc.createDataChannel('oai-events')
      setupDataChannelHandlers(dc)

      // 3. Offer SDP 生成
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 4. サーバーに送信
      const response = await fetch(`${API_BASE_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          clientTools: clientToolDefinitions,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()

      // 5. Answer SDP を設定して接続確立
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: data.sdp,
      })

      isConnected.value = true
      addConversationLog(
        'system',
        '接続しました。話しかけてください。'
      )
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : '接続に失敗しました'
      disconnect()
    } finally {
      isConnecting.value = false
    }
  }

  // ── DataChannel イベントハンドラー ──
  function setupDataChannelHandlers(dataChannel: RTCDataChannel) {
    dataChannel.onopen = () => {
      console.log('[DataChannel] opened')
      // 接続直後に AI に挨拶を促す
      setTimeout(() => {
        dataChannel.send(JSON.stringify({ type: 'response.create' }))
      }, 500)
    }

    dataChannel.onclose = () => {
      console.log('[DataChannel] closed')
      isConnected.value = false
    }

    dataChannel.onmessage = event => {
      try {
        const serverEvent = JSON.parse(event.data)
        handleServerEvent(serverEvent, dataChannel)
      } catch (err) {
        console.error('[DataChannel] Failed to parse message:', err)
      }
    }
  }

  // ── サーバーイベントハンドラー ──
  function handleServerEvent(
    event: Record<string, unknown>,
    dataChannel: RTCDataChannel
  ) {
    switch (event.type) {
      // ── AI がツール呼び出しを開始 ──
      case 'response.output_item.added': {
        const item = event.item as Record<string, unknown> | undefined
        if (item?.type === 'function_call') {
          const name = item.name as string
          isAiThinking.value = true
          toolInProgress.value =
            toolActivityLabels[name] ?? `${name} を実行中...`
        }
        break
      }

      // ── AI レスポンス完了 ──
      case 'response.done': {
        isAiThinking.value = false
        toolInProgress.value = null
        break
      }

      // ── 音声テキスト化（ユーザー発話） ──
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event.transcript as string
        if (transcript?.trim()) {
          addConversationLog('user', transcript.trim())
        }
        break
      }

      // ── AI 音声出力（発話検知） ──
      // タブレット等では echoCancellation が効かずループバックするため、
      // AI 発話中はマイクを自動ミュートして再入力を防ぐ
      case 'output_audio_buffer.started': {
        isAiSpeaking.value = true
        if (micUnmuteTimer) {
          clearTimeout(micUnmuteTimer)
          micUnmuteTimer = null
        }
        setMicTrackEnabled(false)
        break
      }
      case 'output_audio_buffer.stopped': {
        isAiSpeaking.value = false
        // 残響を拾わないよう少し遅延してからマイクを戻す
        micUnmuteTimer = setTimeout(() => {
          setMicTrackEnabled(true)
          micUnmuteTimer = null
        }, 300)
        break
      }

      // ── AI 応答テキスト（音声トランスクリプト） ──
      case 'response.output_audio_transcript.done': {
        const transcript = event.transcript as string
        if (transcript?.trim()) {
          addConversationLog('assistant', transcript.trim())
        }
        break
      }

      // ── Function Call（出力アイテム完了時） ──
      case 'response.output_item.done': {
        const item = event.item as Record<string, unknown> | undefined
        if (item?.type === 'function_call') {
          const callId = item.call_id as string
          const name = item.name as string
          const argsStr = item.arguments as string
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(argsStr)
          } catch {
            // parse error
          }

          console.log(
            `[Function Call] ${name}(${JSON.stringify(args)})`
          )

          // クライアント側ツール名一覧にあれば実行
          if (clientToolNames.has(name)) {
            const result = executeClientTool(name, args, handlers)

            // 実行ログ記録
            addToolCallLog(callId, name, args, result, 'client')

            // 結果を Realtime API に返す
            dataChannel.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify(result),
                },
              })
            )
            dataChannel.send(
              JSON.stringify({ type: 'response.create' })
            )
          } else {
            // サーバー側ツール → WebSocket 経由で処理されるのでログのみ
            addToolCallLog(callId, name, args, undefined, 'server')
          }
        }
        break
      }

      // ── サーバー側ツール実行結果（function_call_output） ──
      case 'response.function_call_arguments.done': {
        // サーバー側で処理済み
        break
      }

      default:
        // その他のイベントはログ出力のみ
        break
    }
  }

  // ── 切断 ──
  function disconnect() {
    if (micUnmuteTimer) {
      clearTimeout(micUnmuteTimer)
      micUnmuteTimer = null
    }
    if (dc) {
      dc.close()
      dc = null
    }
    if (pc) {
      pc.close()
      pc = null
    }
    if (localMicStream) {
      localMicStream.getTracks().forEach(track => track.stop())
      localMicStream = null
    }
    audioEl.srcObject = null
    isConnected.value = false
    isAiThinking.value = false
    isAiSpeaking.value = false
    toolInProgress.value = null
  }

  // ── マイク ON/OFF ──
  function toggleMicrophone(enabled?: boolean) {
    if (!localMicStream) return

    const newState = enabled ?? !isMicEnabled.value
    localMicStream.getAudioTracks().forEach(track => {
      track.enabled = newState
    })
    isMicEnabled.value = newState
  }

  // ── テキスト送信 ──
  function sendTextMessage(text: string) {
    if (!dc || dc.readyState !== 'open') return

    addConversationLog('user', text)

    dc.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
    )
    dc.send(JSON.stringify({ type: 'response.create' }))
  }

  // ── 音量制御 ──
  function setVolume(volume: number) {
    audioEl.volume = Math.max(0, Math.min(1, volume / 100))
  }

  // ── ログ追加 ──
  function addConversationLog(
    role: 'user' | 'assistant' | 'system',
    content: string
  ) {
    conversationLog.value.push({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      role,
      content,
    })
  }

  function addToolCallLog(
    callId: string,
    name: string,
    args: Record<string, unknown>,
    result: unknown,
    source: 'client' | 'server'
  ) {
    toolCallLog.value.push({
      callId,
      name,
      args,
      result,
      source,
      timestamp: new Date(),
    })
  }

  // コンポーネントアンマウント時に自動クリーンアップ
  onUnmounted(disconnect)

  return {
    // 状態
    isConnected,
    isConnecting,
    isMicEnabled,
    isAiThinking,
    isAiSpeaking,
    toolInProgress,
    conversationLog,
    toolCallLog,
    error,
    // メソッド
    connect,
    disconnect,
    toggleMicrophone,
    sendTextMessage,
    setVolume,
  }
}
