<script setup lang="ts">
import { computed } from 'vue'

/**
 * ピザプレビュー / 注文結果パネル
 *
 * mode='preview' : トッピング変更のたびにリアルタイム更新
 * mode='result'  : 注文確定後の結果表示
 */
const props = defineProps<{
  mode: 'preview' | 'result'
  pizzaName: string
  size: string
  toppings: string[]
  orderId?: string
  orderItems?: Array<{ pizza_name: string; size: string; toppings: string[]; quantity: number; subtotal: number }>
  total?: number
  estimatedMinutes?: number
}>()

// ─────────────────────────────────────────────
// トッピング設定
//   type: 'sauce'   → ソース層の背景色を変える（画像不使用）
//   type: 'topping' → image の PNG を count 個、黄金角で散りばめる
//                     画像が未配置の間は emoji にフォールバック
// ─────────────────────────────────────────────
type SauceEntry   = { type: 'sauce';   sauceColor: [string, string]; emoji: string }
type ToppingEntry = { type: 'topping'; image: string; count: number; emoji: string }
type ToppingConfig = SauceEntry | ToppingEntry

const toppingConfig: Record<string, ToppingConfig> = {
  // ── ソース（背景グラデーションを変える） ──
  'トマトソース': { type: 'sauce',   sauceColor: ['#ef4444', '#b91c1c'], emoji: '🍅' },
  'BBQソース':   { type: 'sauce',   sauceColor: ['#a16207', '#78350f'], emoji: '🍖' },

  // ── トッピング（count 個を黄金角配置、画像は /toppings/*.png） ──
  'モッツァレラ':   { type: 'topping', image: '/toppings/mozzarella.png',  count: 3, emoji: '🧀' },
  'バジル':         { type: 'topping', image: '/toppings/basil.png',        count: 3, emoji: '🌿' },
  'ペパロニ':       { type: 'topping', image: '/toppings/pepperoni.png',    count: 5, emoji: '🌶️' },
  'ゴルゴンゾーラ': { type: 'topping', image: '/toppings/gorgonzola.png',   count: 3, emoji: '🧀' },
  'パルメザン':     { type: 'topping', image: '/toppings/parmesan.png',     count: 3, emoji: '🧀' },
  'カマンベール':   { type: 'topping', image: '/toppings/camembert.png',    count: 3, emoji: '🧀' },
  'チキン':         { type: 'topping', image: '/toppings/chicken.png',      count: 4, emoji: '🍗' },
  '玉ねぎ':         { type: 'topping', image: '/toppings/onion.png',        count: 4, emoji: '🧅' },
  'ハム':           { type: 'topping', image: '/toppings/ham.png',          count: 4, emoji: '🥩' },
  'サラミ':         { type: 'topping', image: '/toppings/salami.png',       count: 4, emoji: '🌭' },
  'アンチョビ':     { type: 'topping', image: '/toppings/anchovy.png',      count: 3, emoji: '🐟' },
  'マッシュルーム': { type: 'topping', image: '/toppings/mushroom.png',     count: 4, emoji: '🍄' },
  'パプリカ':       { type: 'topping', image: '/toppings/paprika.png',      count: 4, emoji: '🫑' },
  'オリーブ':       { type: 'topping', image: '/toppings/olive.png',        count: 5, emoji: '⚫' },
  'ガーリック':     { type: 'topping', image: '/toppings/garlic.png',       count: 3, emoji: '🧄' },
}

// ─────────────────────────────────────────────
// ソース色（最初に見つかったソースを採用、デフォルトはトマト）
// ─────────────────────────────────────────────
const DEFAULT_SAUCE: [string, string] = ['#ef4444', '#b91c1c']

const sauceColor = computed<[string, string]>(() => {
  for (const t of props.toppings) {
    const cfg = toppingConfig[t]
    if (cfg?.type === 'sauce') return cfg.sauceColor
  }
  return DEFAULT_SAUCE
})

const sauceStyle = computed(() => ({
  background: `radial-gradient(circle at 38% 32%, ${sauceColor.value[0]}, ${sauceColor.value[1]})`,
}))

// ─────────────────────────────────────────────
// Phyllotaxis（黄金角）配置
//   全トッピングのインスタンスを一括で並べることで
//   トッピング間・トッピング内どちらも偏りなく散りばめる
// ─────────────────────────────────────────────
const GOLDEN_ANGLE_DEG = 137.508

const placedInstances = computed(() => {
  // 1. ソース以外のインスタンスをフラット化
  const instances: Array<{ label: string; image: string; emoji: string }> = []
  for (const t of props.toppings) {
    const cfg = toppingConfig[t]
    if (!cfg || cfg.type === 'sauce') continue
    for (let j = 0; j < cfg.count; j++) {
      instances.push({ label: t, image: cfg.image, emoji: cfg.emoji })
    }
  }

  const n = instances.length
  if (n === 0) return []

  // 2. 黄金角 × sqrt スパイラルで配置（ひまわり種パターン）
  //    r = R_MAX * sqrt( (i + 0.5) / n ) で中心密度が均一になる
  const R_MAX = 38 // pizza-sauce 内の % 半径
  return instances.map((inst, i) => {
    const angleDeg = i * GOLDEN_ANGLE_DEG
    const rad = (angleDeg * Math.PI) / 180
    const r = R_MAX * Math.sqrt((i + 0.5) / n)
    return {
      ...inst,
      top:  `${50 + r * Math.sin(rad)}%`,
      left: `${50 + r * Math.cos(rad)}%`,
    }
  })
})

// チップ表示用
const toppingChips = computed(() =>
  props.toppings.map((t) => {
    const cfg = toppingConfig[t]
    return {
      label: t,
      emoji: cfg?.emoji ?? '🍕',
      isSauce: cfg?.type === 'sauce',
      sauceColor: cfg?.type === 'sauce' ? cfg.sauceColor[0] : null,
    }
  }),
)

// 現在のピザにソースが含まれているか
const hasSauce = computed(() =>
  props.toppings.some((t) => toppingConfig[t]?.type === 'sauce')
)

const sizeLabel = computed(
  () => ({ S: 'S（小）', M: 'M（中）', L: 'L（大）' } as Record<string, string>)[props.size] ?? props.size,
)

const pizzaSize = computed(
  () => ({ S: 130, M: 170, L: 210 } as Record<string, number>)[props.size] ?? 170,
)

const sizeStyle2 = computed(() => ({
  width: `${pizzaSize.value}px`,
  height: `${pizzaSize.value}px`,
}))
</script>

<template>
  <section class="card pizza-panel">
    <h2>{{ mode === 'result' ? '🎉 ご注文確定' : '🍕 ピザプレビュー' }}</h2>

    <!-- ピザビジュアル -->
    <div class="pizza-visual-wrap">
      <div class="pizza-plate" :style="sizeStyle2">
        <div class="pizza-dough">
          <div class="pizza-sauce" :style="sauceStyle">
            <!-- 黄金角配置されたトッピング画像（画像未配置時は絵文字フォールバック） -->
            <template v-for="(item, i) in placedInstances" :key="i">
              <img
                :src="item.image"
                :alt="item.label"
                class="topping-img"
                :style="{ top: item.top, left: item.left }"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <!-- 画像ロード失敗時に絵文字が代わりに見えるよう後ろに重ねる -->
              <span
                class="topping-emoji-fallback"
                :style="{ top: item.top, left: item.left }"
                aria-hidden="true"
              >{{ item.emoji }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 名前・サイズ -->
    <div class="pizza-detail">
      <span class="pizza-name">{{ pizzaName }}</span>
      <span class="pizza-size-badge">{{ sizeLabel }}</span>
    </div>

    <!-- トッピングチップ -->
    <div class="topping-list">
      <!-- ソースなし表示 -->
      <span v-if="!hasSauce" class="topping-chip sauce-none">🫙 ソースなし</span>
      <span
        v-for="chip in toppingChips"
        :key="chip.label"
        class="topping-chip"
        :class="{ 'sauce-chip': chip.isSauce }"
        :style="chip.isSauce && chip.sauceColor
          ? { background: chip.sauceColor + '22', borderColor: chip.sauceColor + '88', color: chip.sauceColor }
          : {}"
      >
        {{ chip.emoji }} {{ chip.label }}
      </span>
    </div>

    <!-- 注文結果 -->
    <div v-if="mode === 'result'" class="order-result">
      <div class="order-result-row">
        <span>注文番号</span>
        <span class="mono">{{ orderId }}</span>
      </div>
      <template v-if="orderItems && orderItems.length > 0">
        <div v-for="item in orderItems" :key="item.pizza_name + item.size" class="order-result-row">
          <span>{{ item.pizza_name }}（{{ item.size }}）×{{ item.quantity }}</span>
          <span>¥{{ item.subtotal.toLocaleString() }}</span>
        </div>
      </template>
      <div class="order-result-row total">
        <span>合計金額</span>
        <span>¥{{ total?.toLocaleString() }}</span>
      </div>
      <div class="order-result-row">
        <span>お届け予定</span>
        <span>約 {{ estimatedMinutes }} 分</span>
      </div>
      <div class="delivery-bar">
        <div class="delivery-progress" :style="{ animationDuration: `${estimatedMinutes}s` }"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pizza-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── ピザビジュアル ── */
.pizza-visual-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.pizza-plate {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 40% 30%, #fde68a, #f59e0b);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), inset 0 -2px 6px rgba(0,0,0,0.1);
  transition: width 0.4s ease, height 0.4s ease;
}

.pizza-dough {
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #fbbf24, #d97706);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pizza-sauce {
  width: 80%;
  height: 80%;
  border-radius: 50%;
  /* background は sauceStyle で動的に上書き */
  background: radial-gradient(circle at 38% 32%, #ef4444, #b91c1c);
  position: relative;
  transition: background 0.5s ease;
}

/* ── トッピング画像（黄金角配置） ── */
.topping-img {
  position: absolute;
  width: 28px;
  height: 28px;
  object-fit: contain;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
  transition: all 0.3s ease;
  z-index: 2;
}

/* 画像ロード失敗時の絵文字フォールバック（img の直下に重なる） */
.topping-emoji-fallback {
  position: absolute;
  font-size: 1rem;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  transition: all 0.3s ease;
  z-index: 1;
  pointer-events: none;
}

/* ── 詳細 ── */
.pizza-detail {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pizza-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a1a2e;
}

.pizza-size-badge {
  background: #667eea;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}

/* ── トッピングチップ ── */
.topping-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topping-chip {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 0.79rem;
  color: #495057;
}

/* ソースチップ専用（色は inline style で上書き） */
.sauce-chip {
  font-weight: 600;
  border-width: 1.5px;
}

.sauce-none {
  background: #f5f5f4;
  border: 1.5px dashed #d6d3d1;
  color: #78716c;
  font-style: italic;
}

/* ── 注文結果 ── */
.order-result {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-result-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #374151;
}

.order-result-row.total {
  font-weight: 700;
  font-size: 1rem;
  color: #16a34a;
  border-top: 1px solid #bbf7d0;
  padding-top: 8px;
}

.mono {
  font-family: monospace;
  font-size: 0.8rem;
}

.delivery-bar {
  height: 6px;
  background: #dcfce7;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.delivery-progress {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 3px;
  animation: delivery-fill linear forwards;
}

@keyframes delivery-fill {
  to { width: 100%; }
}
</style>
