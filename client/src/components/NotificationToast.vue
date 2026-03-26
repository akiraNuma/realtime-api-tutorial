<script setup lang="ts">
defineProps<{
  notifications: Array<{
    id: string
    title: string
    message: string
    type: string
  }>
}>()
</script>

<template>
  <div class="notification-container">
    <TransitionGroup name="toast">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="toast"
        :class="'toast-' + n.type"
      >
        <div class="toast-icon">
          {{ { success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌' }[n.type] || 'ℹ️' }}
        </div>
        <div class="toast-body">
          <div class="toast-title">{{ n.title }}</div>
          <div class="toast-message">{{ n.message }}</div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 280px;
}

.toast-success {
  border-left: 4px solid #198754;
}
.toast-info {
  border-left: 4px solid #0d6efd;
}
.toast-warning {
  border-left: 4px solid #ffc107;
}
.toast-error {
  border-left: 4px solid #dc3545;
}

.toast-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.toast-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: #343a40;
}

.toast-message {
  font-size: 0.82rem;
  color: #6c757d;
  margin-top: 2px;
}

/* ── Transition ── */
.toast-enter-active {
  transition: all 0.3s ease;
}
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
