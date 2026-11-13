import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types'

// O que uma ferramenta do assistente do canvas recebe e devolve. As ferramentas são funções
// comuns: mexem nos blocos e na tela só pelo `env`, por isso dá para testar sem React nem Electron.

export type Args = Record<string, unknown>

export type ToolEnv = {
  // Blocos como estão agora, já com o que as ações anteriores mudaram.
  nodes(): CanvasNode[]
  // Aplica a mudança na hora: cada ação vira um passo do ⌘Z.
  apply(next: CanvasNode[]): void
  // Centro da tela e área visível, em coordenadas do canvas.
  screenCenter(): XYPosition
  visibleArea(): { topLeft: XYPosition; bottomRight: XYPosition }
  // Enquadra os blocos pedidos (sem ids, todos).
  frame(ids: string[]): void
  pickFolder(): Promise<string | null>
  killTerminal(id: string): void
}

// Devolve o texto que volta para o Claude.
export type Tool = (args: Args, env: ToolEnv) => string | Promise<string>

// Erro de uso (bloco que não existe, argumento que não serve): a mensagem vai para o Claude como está.
export class ToolError extends Error {}
