import { z } from 'zod'
import {
  type FunctionTool,
  type ToolCallback,
  type ToolDefinition,
} from './types.js'
import { serverToolDefinitions } from './tools/index.js'
import { logger } from '../logger/logger.js'

// ── サーバーツール: 登録・実行 ──

type RegisteredTool = { def: ToolDefinition; tool: FunctionTool }

const serverTools: RegisteredTool[] = []

export function registerServerTools(defs: ToolDefinition[]): void {
  for (const def of defs) {
    // Zod v4 の組み込み変換を使用
    // $schema は JSON Schema のメタフィールドで OpenAI API には不要なため除外する
    const { $schema: _$schema, ...parameters } = z.toJSONSchema(
      def.schema
    ) as Record<string, unknown>
    serverTools.push({
      def,
      tool: {
        type: 'function',
        name: def.name,
        description: def.description,
        parameters: { ...parameters, additionalProperties: false },
      },
    })
  }
}

export function getRegisteredServerTools(): FunctionTool[] {
  return serverTools.map(s => s.tool)
}

export async function executeFunction(
  name: string,
  args: Record<string, unknown>,
  output: ToolCallback
) {
  try {
    const entry = serverTools.find(s => s.def.name === name)
    if (!entry) return output({ error: `Unknown function: ${name}` })
    const parsed = entry.def.schema.parse(args)
    output(await entry.def.execute(parsed))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`Error executing ${name}: ${msg}`)
    output({ error: `Failed to execute ${name}: ${msg}` })
  }
}

// アプリ起動時にサーバー側ツールを一括登録
registerServerTools(serverToolDefinitions)
