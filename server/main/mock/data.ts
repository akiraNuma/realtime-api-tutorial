// モックデータ（インメモリ）

// ── メニューマスタ ──

export type MenuItem = {
  id: string
  name: string
  description: string
  base_toppings: string[]
  price: { S: number; M: number; L: number }
}

export const menuItems: MenuItem[] = [
  {
    id: 'margherita',
    name: 'マルゲリータ',
    description:
      'フレッシュトマトソース・モッツァレラ・バジルの定番ピザ',
    base_toppings: ['トマトソース', 'モッツァレラ', 'バジル'],
    price: { S: 900, M: 1200, L: 1500 },
  },
  {
    id: 'pepperoni',
    name: 'ペパロニ',
    description: 'スパイシーなペパロニをたっぷり乗せた人気 No.1',
    base_toppings: ['トマトソース', 'モッツァレラ', 'ペパロニ'],
    price: { S: 1000, M: 1400, L: 1800 },
  },
  {
    id: 'quattro_formaggi',
    name: 'クワトロフォルマッジ',
    description: '4 種のチーズが織りなすリッチな濃厚ピザ',
    base_toppings: [
      'モッツァレラ',
      'ゴルゴンゾーラ',
      'パルメザン',
      'カマンベール',
    ],
    price: { S: 1100, M: 1500, L: 1900 },
  },
  {
    id: 'bbq_chicken',
    name: 'BBQチキン',
    description: 'BBQソースとジューシーなチキンの甘辛ピザ',
    base_toppings: ['BBQソース', 'チキン', '玉ねぎ', 'モッツァレラ'],
    price: { S: 1100, M: 1500, L: 1900 },
  },
  {
    id: 'veggie',
    name: 'ヴェジー',
    description: '旬の野菜たっぷりのヘルシーピザ',
    base_toppings: [
      'トマトソース',
      'モッツァレラ',
      'パプリカ',
      'マッシュルーム',
      'オリーブ',
    ],
    price: { S: 900, M: 1200, L: 1500 },
  },
]

export const extraToppings: string[] = [
  'バジル',
  'ハム',
  'サラミ',
  'アンチョビ',
  'マッシュルーム',
  '玉ねぎ',
  'パプリカ',
  'オリーブ',
  'ガーリック',
]

export const sauces: string[] = ['トマトソース', 'BBQソース']

// ── 注文 ──

export type OrderItem = {
  pizza_id: string
  pizza_name: string
  size: 'S' | 'M' | 'L'
  toppings: string[]
  quantity: number
  unit_price: number
  subtotal: number
}

export type Order = {
  id: string
  customer_name: string
  items: OrderItem[]
  total: number
  estimated_minutes: number
  created_at: string
}

// 注文リスト（新しい注文が push される）
export const orders: Order[] = []

// 注文 ID 発行のモック関数
let nextOrderNum = 1
export const generateOrderId = (): string =>
  `order-${String(nextOrderNum++).padStart(3, '0')}`
