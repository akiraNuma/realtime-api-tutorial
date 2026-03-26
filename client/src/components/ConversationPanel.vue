<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { ConversationLogEntry } from '../types'

const props = defineProps<{
  log: ConversationLogEntry[]
  isAiThinking?: boolean
  toolInProgress?: string | null
}>()

const scrollContainer = ref<HTMLElement>()

watch(
  () => props.log.length,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop =
          scrollContainer.value.scrollHeight
      }
    })
  }
)

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <section class="card conversation-panel">
    <h2>💬 会話ログ</h2>
    <div v-if="isAiThinking" class="thinking-indicator">
      <span class="thinking-dot"></span>
      {{ toolInProgress ?? 'AI が考えています...' }}
    </div>
    <div ref="scrollContainer" class="conversation-scroll">
      <div v-if="log.length === 0" class="empty-state">
        まだ会話がありません。接続して話しかけてください。
      </div>
      <div
        v-for="entry in log"
        :key="entry.id"
        class="message"
        :class="'message-' + entry.role"
      >
        <div class="message-header">
          <span class="message-role">
            {{
              {
                user: '🧑 あなた',
                assistant: '🤖 AI',
                system: '⚙️ システム',
              }[entry.role]
            }}
          </span>
          <span class="message-time">{{
            formatTime(entry.timestamp)
          }}</span>
        </div>
        <div class="message-content">{{ entry.content }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.conversation-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.conversation-scroll {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  color: #868e96;
  font-size: 0.9rem;
  text-align: center;
  padding: 40px 0;
}

.message {
  border-radius: 8px;
  padding: 10px 14px;
}

.message-user {
  background: #e3f2fd;
  align-self: flex-end;
  max-width: 80%;
  margin-left: auto;
}

.message-assistant {
  background: #f1f3f5;
  align-self: flex-start;
  max-width: 80%;
}

.message-system {
  background: #fff3cd;
  align-self: center;
  font-size: 0.82rem;
  max-width: 90%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.message-role {
  font-size: 0.78rem;
  font-weight: 600;
  color: #495057;
}

.message-time {
  font-size: 0.72rem;
  color: #868e96;
}

.message-content {
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #f1f3f5;
  border-radius: 8px;
  font-size: 0.82rem;
  color: #6c757d;
  animation: pulse-text 1.5s ease-in-out infinite;
}

.thinking-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: pulse-dot 1s ease-in-out infinite;
}

@keyframes pulse-text {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}
</style>
