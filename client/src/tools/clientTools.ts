import { z } from 'zod'

// ────────────────────────────────────────────────
// クライアントツールハンドラー（App.vue から注入）
// ────────────────────────────────────────────────

export type MenuItemData = {
  id: string
  name: string
  description: string
  base_toppings: string[]
  price: { S: number; M: number; L: number }
}

export type OrderItem = {
  pizza_name: string
  size: string
  toppings: string[]
  quantity: number
  subtotal: number
}

export type ClientToolHandlers = {
  onShowNotification: (
    title: string,
    message: string,
    type?: string
  ) => void
  onShowMenu: (
    menu: MenuItemData[],
    extraToppings: string[],
    extraToppingPrice: number,
    sauces: string[]
  ) => void
  onPreviewPizza: (
    pizzaName: string,
    toppings: string[],
    size: string
  ) => void
  onShowOrderResult: (
    orderId: string,
    items: OrderItem[],
    total: number,
    estimatedMinutes: number
  ) => void
}

// ────────────────────────────────────────────────
// ツール定義型
// ────────────────────────────────────────────────

type ToolResult = { success: boolean; message?: string }

type ClientToolDef<TSchema extends z.ZodType = z.ZodType> = {
  name: string
  description: string
  schema: TSchema
  execute: (
    args: z.infer<TSchema>,
    handlers: ClientToolHandlers
  ) => ToolResult
}

/** スキーマ型を正しく推論させるためのヘルパー */
function defineTool<TSchema extends z.ZodType>(
  def: ClientToolDef<TSchema>
) {
  return def
}

// ────────────────────────────────────────────────
// ツール定義（スキーマ・実行ロジックを 1 か所にまとめる）
// ────────────────────────────────────────────────

const showNotification = defineTool({
  name: 'show_notification',
  description:
    '画面上に通知メッセージを表示します。注文完了など重要な結果をユーザーに視覚的に伝える場合に使います。',
  schema: z.object({
    title: z.string().describe('通知タイトル'),
    message: z.string().describe('通知メッセージ'),
    type: z
      .enum(['success', 'info', 'warning', 'error'])
      .optional()
      .describe('通知種別'),
  }),
  execute(args, handlers) {
    handlers.onShowNotification(args.title, args.message, args.type)
    return { success: true, message: '通知を表示しました' }
  },
})

const showMenu = defineTool({
  name: 'show_menu',
  description:
    'ピザメニューと追加トッピング一覧を画面に表示します。search_menu で取得したデータをそのまま渡してください。接続直後に必ず呼び出してください。',
  schema: z.object({
    menu: z
      .array(
        z.object({
          id: z.string().describe('メニュー ID'),
          name: z.string().describe('ピザ名'),
          description: z.string().describe('説明'),
          base_toppings: z
            .array(z.string())
            .describe('ベーストッピング'),
          price: z
            .object({
              S: z.number(),
              M: z.number(),
              L: z.number(),
            })
            .describe('サイズ別価格'),
        })
      )
      .describe('ピザメニュー一覧'),
    sauces: z.array(z.string()).describe('ソースの種類一覧'),
    extra_toppings: z
      .array(z.string())
      .describe('追加可能なトッピング一覧'),
    extra_topping_price: z
      .number()
      .describe('追加トッピング 1 種あたりの価格（円）'),
  }),
  execute(args, handlers) {
    handlers.onShowMenu(
      args.menu as MenuItemData[],
      args.extra_toppings,
      args.extra_topping_price,
      args.sauces
    )
    return { success: true, message: 'メニューを表示しました' }
  },
})

const previewPizza = defineTool({
  name: 'preview_pizza',
  description:
    'ピザのプレビューを画面に表示します。ピザ名・サイズ・トッピングが決まるたびに呼び出してください。トッピングが変わるたびに再呼び出しして画面を更新してください。',
  schema: z.object({
    pizza_name: z.string().describe('ピザの名前（例: マルゲリータ）'),
    size: z.string().describe('サイズ（S / M / L）'),
    toppings: z
      .array(z.string())
      .describe('すべてのトッピング（ベース＋追加）'),
  }),
  execute(args, handlers) {
    handlers.onPreviewPizza(args.pizza_name, args.toppings, args.size)
    return { success: true, message: 'プレビューを更新しました' }
  },
})

const showOrderResult = defineTool({
  name: 'show_order_result',
  description:
    '注文完了後に注文結果パネルを表示します。place_order の直後に必ず呼び出してください。',
  schema: z.object({
    order_id: z.string().describe('注文 ID'),
    items: z
      .array(
        z.object({
          pizza_name: z.string().describe('ピザ名'),
          size: z.string().describe('サイズ（S / M / L）'),
          toppings: z.array(z.string()).describe('全トッピング'),
          quantity: z.number().describe('個数'),
          subtotal: z.number().describe('小計（円）'),
        })
      )
      .describe('注文アイテム一覧'),
    total: z.number().describe('合計金額（円）'),
    estimated_minutes: z.number().describe('お届け予定時間（分）'),
  }),
  execute(args, handlers) {
    handlers.onShowOrderResult(
      args.order_id,
      args.items,
      args.total,
      args.estimated_minutes
    )
    return { success: true, message: '注文結果を表示しました' }
  },
})

// 新しいツールはここに追加して clientTools 配列に並べるだけ
const clientTools = [
  showNotification,
  showMenu,
  previewPizza,
  showOrderResult,
]

// ────────────────────────────────────────────────
// 公開 API（useRealtimeConnection から使用）
// ────────────────────────────────────────────────

/** OpenAI Realtime API に登録するツールスキーマ一覧（Zod v4 の toJSONSchema で自動生成） */
export const clientToolDefinitions = clientTools.map(t => {
  // $schema は JSON Schema のメタフィールドで OpenAI API には不要なため除外する
  const { $schema: _$schema, ...parameters } = z.toJSONSchema(
    t.schema
  ) as Record<string, unknown>
  return {
    type: 'function' as const,
    name: t.name,
    description: t.description,
    parameters: { ...parameters, additionalProperties: false },
  }
})

/** ツール名で検索して Zod バリデーション済み引数でハンドラーを呼び出す */
export function executeClientTool(
  name: string,
  rawArgs: Record<string, unknown>,
  handlers: ClientToolHandlers
): ToolResult {
  const tool = clientTools.find(t => t.name === name)
  if (!tool)
    return { success: false, message: `Unknown client tool: ${name}` }
  // スキーマと execute は同一ツール定義から来るため型安全だが、
  // TypeScript は相関ユニオン型を推論できないため型アサーションで解消する
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = tool.schema.parse(rawArgs) as any
  return tool.execute(args, handlers)
}
