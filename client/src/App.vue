<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useRealtimeConnection } from './composables/useRealtimeConnection'
import ConversationPanel from './components/ConversationPanel.vue'
import PizzaPreviewPanel from './components/PizzaPreviewPanel.vue'
import MenuPanel from './components/MenuPanel.vue'
import NotificationToast from './components/NotificationToast.vue'
import type {
  ClientToolHandlers,
  MenuItemData,
  OrderItem,
} from './tools/clientTools'

// ── 通知管理 ──
type Notification = {
  id: string
  title: string
  message: string
  type: string
}

const notifications = ref<Notification[]>([])

function addNotification(
  title: string,
  message: string,
  type = 'info'
) {
  const id = crypto.randomUUID()
  notifications.value.push({ id, title, message, type })
  setTimeout(() => {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }, 6000)
}

// ── ピザパネル状態管理 ──
type PizzaState = {
  mode: 'preview' | 'result'
  pizzaName: string
  size: string
  toppings: string[]
  orderId: string
  orderItems: OrderItem[]
  total: number
  estimatedMinutes: number
}

const pizzaState = ref<PizzaState | null>(null)
const isDebugOpen = ref(false)

// ── メニューパネル状態管理 ──
type MenuState = {
  menu: MenuItemData[]
  extraToppings: string[]
  extraToppingPrice: number
  sauces: string[]
}
const menuState = ref<MenuState | null>(null)

// ── クライアントツールハンドラー ──
const clientToolHandlers: ClientToolHandlers = {
  onShowNotification: (
    title: string,
    message: string,
    type?: string
  ) => {
    addNotification(title, message, type ?? 'info')
  },
  onShowMenu: (
    menu: MenuItemData[],
    extraToppings: string[],
    extraToppingPrice: number,
    sauces: string[]
  ) => {
    menuState.value = {
      menu,
      extraToppings,
      extraToppingPrice,
      sauces,
    }
  },
  onPreviewPizza: (
    pizzaName: string,
    toppings: string[],
    size: string
  ) => {
    pizzaState.value = {
      mode: 'preview',
      pizzaName,
      size,
      toppings,
      orderId: '',
      orderItems: [],
      total: 0,
      estimatedMinutes: 0,
    }
  },
  onShowOrderResult: (
    orderId: string,
    items: OrderItem[],
    total: number,
    estimatedMinutes: number
  ) => {
    const first = items[0]
    pizzaState.value = {
      mode: 'result',
      pizzaName: first?.pizza_name ?? '',
      size: first?.size ?? '',
      toppings: first?.toppings ?? [],
      orderId,
      orderItems: items,
      total,
      estimatedMinutes,
    }
  },
}

const connection = useRealtimeConnection(clientToolHandlers)

// ── テキスト入力 ──
const textInput = ref('')
const textInputEl = ref<HTMLInputElement>()

function handleSendText() {
  const text = textInput.value.trim()
  if (!text || !connection.isConnected.value) return
  connection.sendTextMessage(text)
  textInput.value = ''
  nextTick(() => textInputEl.value?.focus())
}

// クィックサジェスト
const suggestions = [
  'マルゲリータのMサイズをください',
  'ペパロニにマッシュルームを追加して',
  'おすすめのピザを教えて',
]

function sendSuggestion(text: string) {
  if (!connection.isConnected.value) return
  connection.sendTextMessage(text)
}

// 音量
const volume = useLocalStorage('volume', 50)
watch(volume, val => connection.setVolume(val), { immediate: true })

// 切断時にパネルをリセット
watch(connection.isConnected, connected => {
  if (!connected) {
    menuState.value = null
    pizzaState.value = null
  }
})
</script>

<template>
  <div class="app">
    <!-- 通知 -->
    <NotificationToast :notifications="notifications" />

    <!-- ====== 未接続: Welcome 画面 ====== -->
    <div
      v-if="
        !connection.isConnected.value &&
        !connection.isConnecting.value
      "
      class="welcome"
    >
      <div class="welcome-inner">
        <div class="welcome-icon">🍕</div>
        <h1 class="welcome-title">AI ピッツェリア</h1>
        <p class="welcome-sub">話しかけるだけでピザを注文できます</p>

        <div class="feature-cards">
          <div class="feature-card">
            <span class="feature-icon">🗣️</span>
            <div>
              <div class="feature-label">こう言うだけで</div>
              <div class="feature-example">
                「マルゲリータのMください」
              </div>
              <div class="feature-desc">
                メニューを自動で取得して提案します
              </div>
            </div>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🍕</span>
            <div>
              <div class="feature-label">
                トッピングをカスタマイズ
              </div>
              <div class="feature-example">
                「バジルとマッシュルームを追加して」
              </div>
              <div class="feature-desc">
                変更のたびにピザをリアルタイムプレビュー
              </div>
            </div>
          </div>
          <div class="feature-card">
            <span class="feature-icon">✅</span>
            <div>
              <div class="feature-label">
                「はい」と言うだけで確定
              </div>
              <div class="feature-example">
                AI が確認 → あなたは承諾するだけ
              </div>
              <div class="feature-desc">
                最小限のやり取りで注文完了
              </div>
            </div>
          </div>
        </div>

        <button class="btn-connect" @click="connection.connect()">
          🎙️ 会話を始める
        </button>

        <p v-if="connection.error.value" class="error-msg">
          ⚠️ {{ connection.error.value }}
        </p>
      </div>
    </div>

    <!-- ====== 接続中スピナー ====== -->
    <div v-else-if="connection.isConnecting.value" class="connecting">
      <div class="spinner"></div>
      <p>接続中...</p>
    </div>

    <!-- ====== 接続済み: Chat 画面 ====== -->
    <div v-else class="chat-screen">
      <!-- ヘッダー -->
      <header class="chat-header">
        <div class="chat-header-left">
          <span class="header-logo">🍕</span>
          <span class="header-title">AI ピッツェリア</span>
          <span class="status-dot"></span>
          <span class="status-text">接続中</span>
        </div>
        <div class="chat-header-right">
          <div class="volume-row">
            <span>🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              v-model.number="volume"
              class="volume-slider"
            />
            <span class="volume-val">{{ volume }}%</span>
          </div>
          <button
            class="btn-icon"
            :class="
              connection.isMicEnabled.value ? 'mic-on' : 'mic-off'
            "
            @click="connection.toggleMicrophone()"
            :title="
              connection.isMicEnabled.value
                ? 'マイクをオフにする'
                : 'マイクをオンにする'
            "
          >
            {{ connection.isMicEnabled.value ? '🎙️' : '🔇' }}
          </button>
          <button
            class="btn-disconnect"
            @click="connection.disconnect()"
          >
            切断
          </button>
        </div>
      </header>

      <!-- メインエリア -->
      <div class="chat-main">
        <!-- チャットカラム -->
        <div class="chat-col">
          <ConversationPanel
            :log="connection.conversationLog.value"
            :is-ai-thinking="connection.isAiThinking.value"
            :tool-in-progress="connection.toolInProgress.value"
          />

          <!-- クイックサジェスト -->
          <div class="suggestions">
            <button
              v-for="s in suggestions"
              :key="s"
              class="suggestion-chip"
              @click="sendSuggestion(s)"
            >
              {{ s }}
            </button>
          </div>

          <!-- テキスト入力 -->
          <div class="text-input-area">
            <input
              ref="textInputEl"
              type="text"
              v-model="textInput"
              placeholder="テキストで入力することもできます..."
              @keyup.enter="handleSendText"
              class="text-input"
            />
            <button
              class="btn-send"
              :disabled="!textInput.trim()"
              @click="handleSendText"
            >
              送信
            </button>
          </div>

          <!-- デバッグトグル -->
          <div class="debug-toggle">
            <button
              class="btn-debug-toggle"
              @click="isDebugOpen = !isDebugOpen"
            >
              {{ isDebugOpen ? '▲' : '▼' }} 🔧 Function Calling
              ログ（{{ connection.toolCallLog.value.length }}件）
            </button>
            <div v-if="isDebugOpen" class="debug-panel">
              <div
                v-if="connection.toolCallLog.value.length === 0"
                class="debug-empty"
              >
                まだツール呼び出しはありません
              </div>
              <div
                v-for="entry in [
                  ...connection.toolCallLog.value,
                ].reverse()"
                :key="entry.callId"
                class="debug-entry"
              >
                <div class="debug-entry-header">
                  <span class="debug-name">{{ entry.name }}</span>
                  <span
                    class="debug-source"
                    :class="'src-' + entry.source"
                  >
                    {{
                      entry.source === 'client' ? 'Client' : 'Server'
                    }}
                  </span>
                  <span class="debug-time">
                    {{
                      entry.timestamp.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    }}
                  </span>
                </div>
                <details>
                  <summary class="debug-summary">引数 / 結果</summary>
                  <pre class="debug-json">{{
                    JSON.stringify(
                      { args: entry.args, result: entry.result },
                      null,
                      2
                    )
                  }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>

        <!-- 右サイドバー：ピザプレビュー（先頭）＋メニュー -->
        <transition name="slide">
          <div v-if="menuState || pizzaState" class="side-col">
            <!-- ピザプレビュー / 注文結果（preview_pizza / show_order_result で表示） -->
            <PizzaPreviewPanel
              v-if="pizzaState"
              :mode="pizzaState.mode"
              :pizza-name="pizzaState.pizzaName"
              :size="pizzaState.size"
              :toppings="pizzaState.toppings"
              :order-id="pizzaState.orderId"
              :order-items="pizzaState.orderItems"
              :total="pizzaState.total"
              :estimated-minutes="pizzaState.estimatedMinutes"
            />
            <!-- メニューパネル（ピザプレビュー中は折りたたんで表示） -->
            <details
              v-if="menuState"
              :open="!pizzaState"
              class="menu-details"
            >
              <summary class="menu-details-summary">
                📋 メニューを{{ pizzaState ? '見る' : '隠す' }}
              </summary>
              <MenuPanel
                v-if="menuState"
                :menu="menuState.menu"
                :extra-toppings="menuState.extraToppings"
                :extra-topping-price="menuState.extraToppingPrice"
                :sauces="menuState.sauces"
              />
            </details>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<style>
/* ── Reset ── */
*,
*::before,
*::after {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f0f2f5;
  color: #1a1a2e;
}

.app {
  min-height: 100vh;
}

/* ==============================
   Welcome
   ============================== */
.welcome {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: linear-gradient(
    150deg,
    #0f2027 0%,
    #203a43 50%,
    #2c5364 100%
  );
}

.welcome-inner {
  text-align: center;
  max-width: 680px;
  width: 100%;
}

.welcome-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
}

.welcome-sub {
  font-size: 1rem;
  color: #ced4da;
  margin: 0 0 36px;
}

.feature-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 36px;
  text-align: left;
}

.feature-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(8px);
}

.feature-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
}

.feature-label {
  font-size: 0.75rem;
  color: #adb5bd;
  margin-bottom: 2px;
}
.feature-example {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}
.feature-desc {
  font-size: 0.8rem;
  color: #ced4da;
}

.btn-connect {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 40px;
  border: none;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}
.btn-connect:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
}
.btn-connect:active {
  transform: translateY(0);
}

.error-msg {
  color: #ff6b6b;
  font-size: 0.9rem;
  margin-top: 16px;
}

/* ==============================
   Connecting Spinner
   ============================== */
.connecting {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: linear-gradient(
    150deg,
    #0f2027 0%,
    #203a43 50%,
    #2c5364 100%
  );
  color: #fff;
  font-size: 1rem;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ==============================
   Chat Screen
   ============================== */
.chat-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header */
.chat-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-logo {
  font-size: 1.3rem;
}
.header-title {
  font-size: 1rem;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
.status-text {
  font-size: 0.8rem;
  color: #75d6a1;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}
.volume-slider {
  width: 80px;
}
.volume-val {
  color: #ced4da;
  font-size: 0.8rem;
  min-width: 36px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  border-radius: 8px;
  padding: 4px 8px;
  transition: background 0.15s;
}
.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}
.mic-on {
  opacity: 1;
}
.mic-off {
  opacity: 0.5;
}

.btn-disconnect {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-disconnect:hover {
  background: rgba(220, 53, 69, 0.35);
  border-color: #dc3545;
}

/* Main */
.chat-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 8px;
}

.chat-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 8px 12px;
  gap: 10px;
}

/* Quick Suggestions */
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.suggestion-chip {
  padding: 7px 14px;
  border: 1.5px solid #667eea;
  border-radius: 20px;
  background: rgba(102, 126, 234, 0.08);
  color: #667eea;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.suggestion-chip:hover {
  background: #667eea;
  color: #fff;
}

/* Text Input */
.text-input-area {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.text-input {
  flex: 1;
  padding: 10px 14px;
  border: 1.5px solid #dee2e6;
  border-radius: 24px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}
.text-input:focus {
  border-color: #667eea;
}

.btn-send {
  padding: 10px 20px;
  border: none;
  border-radius: 24px;
  background: #667eea;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-send:not(:disabled):hover {
  background: #5a6fd1;
}

/* Debug toggle */
.debug-toggle {
  flex-shrink: 0;
}

.btn-debug-toggle {
  background: none;
  border: none;
  font-size: 0.78rem;
  color: #868e96;
  cursor: pointer;
  padding: 2px 0;
}
.btn-debug-toggle:hover {
  color: #495057;
}

.debug-panel {
  margin-top: 8px;
  background: #f8f9fb;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 10px;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.debug-empty {
  color: #868e96;
  font-size: 0.82rem;
  text-align: center;
  padding: 12px 0;
}

.debug-entry {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 12px;
}

.debug-entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.debug-name {
  font-weight: 600;
  font-size: 0.82rem;
}
.debug-source {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.src-server {
  background: #e3f2fd;
  color: #1565c0;
}
.src-client {
  background: #e8f5e9;
  color: #2e7d32;
}
.debug-time {
  font-size: 0.75rem;
  color: #868e96;
  margin-left: auto;
}
.debug-summary {
  font-size: 0.78rem;
  color: #6c757d;
  cursor: pointer;
}
.debug-json {
  font-size: 0.75rem;
  background: #f1f3f5;
  border-radius: 4px;
  padding: 6px 8px;
  margin: 4px 0 0;
  overflow-x: auto;
  white-space: pre;
}

/* Side column (pizza preview + menu) */
.side-col {
  width: 420px;
  flex-shrink: 0;
  padding: 16px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

/* メニュー折りたたみ */
.menu-details {
  border: none;
  outline: none;
}

.menu-details-summary {
  cursor: pointer;
  font-size: 0.82rem;
  color: #6b7280;
  padding: 4px 2px;
  list-style: none;
  user-select: none;
}
.menu-details-summary::marker,
.menu-details-summary::-webkit-details-marker {
  display: none;
}
.menu-details-summary:hover {
  color: #374151;
}

/* Sidebar slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}
.slide-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

/* Responsive */
@media (max-width: 800px) {
  .side-col {
    width: 100%;
  }
  .chat-main {
    flex-direction: column;
  }
  .volume-row {
    display: none;
  }
}
</style>
