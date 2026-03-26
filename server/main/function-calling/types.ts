import { type z } from 'zod'

export type FunctionTool = {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolCallback = (result: unknown) => void

export interface ToolDefinition<
  TSchema extends z.ZodType = z.ZodType,
  TResult = unknown,
> {
  readonly name: string
  readonly description: string
  readonly schema: TSchema
  readonly execute: (args: z.infer<TSchema>) => Promise<TResult>
}
