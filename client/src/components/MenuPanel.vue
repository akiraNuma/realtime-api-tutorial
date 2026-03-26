<script setup lang="ts">
/**
 * メニューパネル
 *
 * show_menu クライアントツールが呼ばれたときに表示。
 * search_menu（サーバー）の戻り値をそのまま受け取る。
 */

export type MenuItemData = {
  id: string
  name: string
  description: string
  base_toppings: string[]
  price: { S: number; M: number; L: number }
}

const props = defineProps<{
  menu: MenuItemData[]
  extraToppings: string[]
  extraToppingPrice: number
  sauces: string[]
}>()

// ピザアイコンマッピング（ベーストッピングから雰囲気を出す）
const pizzaIcon: Record<string, string> = {
  'マルゲリータ':     '🍅',
  'ペパロニ':         '🌶️',
  'クワトロフォルマッジ': '🧀',
  'BBQチキン':        '🍗',
  'ヴェジー':         '🥦',
}
</script>

<template>
  <section class="card menu-panel">
    <h2>📋 本日のメニュー</h2>

    <!-- ピザカード一覧 -->
    <div class="pizza-grid">
      <div v-for="item in menu" :key="item.id" class="pizza-card">
        <div class="pizza-card-header">
          <span class="pizza-icon">{{ pizzaIcon[item.name] ?? '🍕' }}</span>
          <div>
            <div class="pizza-card-name">{{ item.name }}</div>
            <div class="pizza-card-desc">{{ item.description }}</div>
          </div>
        </div>

        <!-- ベーストッピング -->
        <div class="base-toppings">
          <span v-for="t in item.base_toppings" :key="t" class="base-chip">{{ t }}</span>
        </div>

        <!-- サイズ・価格表 -->
        <div class="price-row">
          <span v-for="(sz, key) in item.price" :key="key" class="price-badge">
            <span class="size-label">{{ key }}</span>
            <span class="price-val">¥{{ sz.toLocaleString() }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 追加トッピング -->
    <div class="extra-section">
      <div class="extra-title">
        ✨ 追加トッピング
        <span class="extra-price-note">各 +¥{{ extraToppingPrice.toLocaleString() }}</span>
      </div>
      <div class="extra-chips">
        <span v-for="t in extraToppings" :key="t" class="extra-chip">{{ t }}</span>
      </div>
    </div>

    <!-- ソース -->
    <div class="extra-section sauce-section">
      <div class="extra-title">🍅 ソース</div>
      <div class="extra-chips">
        <span v-for="s in sauces" :key="s" class="extra-chip sauce-chip-menu">{{ s }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.menu-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── ピザグリッド ── */
.pizza-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pizza-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;
}

.pizza-card:hover {
  border-color: #667eea;
}

.pizza-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pizza-icon {
  font-size: 1.6rem;
  line-height: 1;
  flex-shrink: 0;
}

.pizza-card-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1a1a2e;
}

.pizza-card-desc {
  font-size: 0.78rem;
  color: #6b7280;
  margin-top: 2px;
  line-height: 1.4;
}

/* ── ベーストッピングチップ ── */
.base-toppings {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.base-chip {
  background: #ede9fe;
  color: #5b21b6;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
}

/* ── 価格バッジ ── */
.price-row {
  display: flex;
  gap: 6px;
}

.price-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 10px;
  gap: 1px;
}

.size-label {
  font-size: 0.68rem;
  color: #9ca3af;
  font-weight: 600;
}

.price-val {
  font-size: 0.82rem;
  font-weight: 700;
  color: #374151;
}

/* ── 追加トッピング ── */
.extra-section {
  background: #fff9f0;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extra-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.extra-price-note {
  font-size: 0.72rem;
  font-weight: 400;
  color: #b45309;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: 10px;
}

.extra-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.extra-chip {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 0.78rem;
  color: #78350f;
}

.sauce-section {
  background: #fef2f2;
  border-color: #fecaca;
}

.sauce-chip-menu {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #b91c1c;
}
</style>
