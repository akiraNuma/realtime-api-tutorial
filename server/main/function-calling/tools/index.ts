import type { ToolDefinition } from '../types.js'
import { searchMenu } from './searchMenu.js'
import { placeOrder } from './placeOrder.js'

/**
 * サーバー側ツール定義一覧
 *
 * ここに追加したツールは tool_registry.ts により
 * 自動的に OpenAI Realtime API のセッションに登録される。
 */
export const serverToolDefinitions: ToolDefinition[] = [
  searchMenu,
  placeOrder,
]
