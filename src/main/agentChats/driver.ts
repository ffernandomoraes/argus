import type { ChatImage, ChatSettings } from '../../shared/chat'
import type { DiffHunk } from '../../shared/history'

// O que a conversa (session.ts) pede a cada agente, e o que ouve dele. Cada CLI fala de um jeito
// (codex.ts: app-server; acp.ts: Gemini e Cursor); aqui tudo chega no formato do chat.

// Uma chamada de ferramenta: aparece ao começar e é atualizada até terminar.
export type ToolEvent = {
  id: string
  // Tipo (command, edit, read, search, fetch, mcp, other) e o nome que o app mostra.
  name: string
  label: string
  // Intenção ou alvo curto (o arquivo, o comando).
  input: string
  detail?: string
  result?: string
  error?: boolean
  diff?: DiffHunk[]
  done: boolean
}

export type PermissionAsk = {
  toolName: string
  label: string
  summary: string
  detail?: string
  diff?: DiffHunk[]
  canAlwaysAllow: boolean
}

export type PermissionReply = 'allow' | 'always' | 'deny'

export type DriverEvents = {
  // Texto da resposta chegando; `done` fecha a mensagem atual (vai para o histórico).
  text: (delta: string) => void
  textDone: () => void
  thought: (delta: string) => void
  thoughtDone: () => void
  tool: (t: ToolEvent) => void
  permission: (ask: PermissionAsk) => Promise<PermissionReply>
  title: (title: string) => void
  // Ocupação do contexto, de 0 a 100, e tokens gerados no pedido.
  usage: (u: { contextPercent?: number; turnTokens?: number }) => void
  // O processo do agente terminou (caiu ou foi fechado).
  exited: (reason?: string) => void
}

export type PromptInput = { text: string; images: ChatImage[] }

export interface Driver {
  // Abre o processo, entra e cria (ou retoma) a conversa do agente. Devolve o id nativo dela.
  start(nativeId?: string): Promise<string>
  // Resolve quando o pedido termina (bem, parado ou com erro, que vem como exceção).
  prompt(input: PromptInput): Promise<void>
  cancel(): Promise<void>
  configure(settings: ChatSettings): Promise<void>
  close(): void
}
