import { z } from 'zod'
import type { ToolDefinition } from '../types.js'
import { menuItems, extraToppings, sauces } from '../../mock/data.js'
import { logger } from '../../logger/logger.js'

const schema = z.object({})

/** ピザメニュー取得 */
export const searchMenu: ToolDefinition<typeof schema> = {
  name: 'search_menu',
  description:
    'ピザのメニュー一覧と追加トッピングの選択肢を取得します。注文内容を決める前に呼び出してください。',
  schema,

  execute: async () => {
    logger.info('search_menu called')
    return {
      menu: menuItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        base_toppings: item.base_toppings,
        price: item.price,
      })),
      sauces,
      extra_toppings: extraToppings,
      extra_topping_price: 100,
      note: '追加トッピングは 1 種類 100 円です。サイズは S（小）/ M（中）/ L（大）。preview_pizza を呼ぶ際は、ベーストッピングのソース含むすべてを toppings に含めてください。',
    }
  },
}
