import type { CanvasToolCall, CanvasToolResult } from '../../../../shared/canvasAgent'
import { blockTools } from './blocks'
import { groupTools } from './groups'
import { layoutTools } from './layout'
import { readTools } from './read'
import { ToolError, type Tool, type ToolEnv } from './tool'

// Ações que o assistente do canvas pode pedir, pelo nome que o processo principal usa.
// Map, e não objeto: um nome como "toString" não vira ação.
const TOOLS = new Map<string, Tool>(Object.entries({ ...readTools, ...layoutTools, ...blockTools, ...groupTools }))

// Executa uma ação e monta a resposta. Nunca rejeita: erro de uso volta com a mensagem dele,
// e qualquer outro erro volta como "Erro: ...", sempre marcado como ação não feita.
export async function runTool(call: CanvasToolCall, env: ToolEnv): Promise<CanvasToolResult> {
  const tool = TOOLS.get(call.name)
  try {
    if (!tool) throw new ToolError(`Ação desconhecida: ${call.name}`)
    return { id: call.id, text: await tool(call.args, env) }
  } catch (err) {
    const text = err instanceof ToolError ? err.message : `Erro: ${(err as Error).message}`
    return { id: call.id, text, error: true }
  }
}

export type { ToolEnv } from './tool'
