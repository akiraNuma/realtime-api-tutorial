import { z } from 'zod'
import type { ToolDefinition } from '../types.js'
import {
  menuItems,
  orders,
  generateOrderId,
} from '../../mock/data.js'
import { logger } from '../../logger/logger.js'

const itemSchema = z.object({
  pizza_id: z
    .string()
    .describe('ピザの ID（search_menu で取得したもの）'),
  size: z
    .enum(['S', 'M', 'L'])
    .describe('サイズ（S=小 1〜2 人, M=中 2〜3 人, L=大 3〜4 人）'),
  extra_toppings: z
    .array(z.string())
    .optional()
    .describe('追加トッピング名の配列（省略可）'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('注文枚数（省略時は 1）'),
})

const schema = z.object({
  customer_name: z.string().describe('お客様のお名前'),
  items: z
    .array(itemSchema)
    .min(1)
    .describe('注文するピザのリスト（1 件以上）'),
})

/** ピザ注文確定 */
export const placeOrder: ToolDefinition<typeof schema> = {
  name: 'place_order',
  description:
    'ピザの注文を確定します。複数種類まとめて注文できます。金額を計算して注文 ID を発行します。確認が取れてから呼び出してください。',
  schema,

  execute: async ({ customer_name, items }) => {
    logger.info(
      `place_order: ${items.length} item(s) by ${customer_name}`
    )

    const orderedItems = []
    let total = 0

    for (const {
      pizza_id,
      size,
      extra_toppings = [],
      quantity = 1,
    } of items) {
      const menuItem = menuItems.find(m => m.id === pizza_id)
      if (!menuItem) {
        return {
          success: false,
          error: `ピザ "${pizza_id}" はメニューに見つかりません。`,
        }
      }
      const unit_price =
        menuItem.price[size] + extra_toppings.length * 100
      const subtotal = unit_price * quantity
      const toppings = [...menuItem.base_toppings, ...extra_toppings]
      total += subtotal
      orderedItems.push({
        pizza_id,
        pizza_name: menuItem.name,
        size,
        toppings,
        quantity,
        unit_price,
        subtotal,
      })
    }

    const estimated_minutes = 20
    const orderId = generateOrderId()

    orders.push({
      id: orderId,
      customer_name,
      items: orderedItems,
      total,
      estimated_minutes,
      created_at: new Date().toISOString(),
    })
    logger.info(`Order created: ${orderId} total=¥${total}`)

    const summary = orderedItems
      .map(i => `${i.pizza_name}（${i.size}）×${i.quantity}`)
      .join('、')
    return {
      success: true,
      order_id: orderId,
      customer_name,
      items: orderedItems,
      total,
      estimated_minutes,
      message: `${summary} の注文を承りました。合計 ¥${total.toLocaleString()} です。約 ${estimated_minutes} 分でお届けします！`,
    }
  },
}
