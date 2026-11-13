import { parseAgentRef, PROVIDER_NAMES, PROVIDERS, type ProviderId } from './providers'

// Cada agente (Claude, Codex, Gemini, Cursor) tem a biblioteca dele: cada um tem pontos fortes
// próprios, e o @ de uma conversa lista só os do agente que roda nela.
export type AgentProvider = 'claude' | ProviderId

export const AGENT_PROVIDERS: AgentProvider[] = ['claude', ...PROVIDERS]

export const agentProviderName = (p: AgentProvider): string => (p === 'claude' ? 'Claude' : PROVIDER_NAMES[p])

// Provedor de uma conversa pela conta dela ("codex:main"); a conta do Claude não tem prefixo.
export const agentProviderOf = (account?: string): AgentProvider => parseAgentRef(account)?.provider ?? 'claude'

export const isAgentProvider = (v: unknown): v is AgentProvider => typeof v === 'string' && (AGENT_PROVIDERS as string[]).includes(v)

// Um agente da biblioteca. No Claude, no Gemini e no Cursor, um .md com cabeçalho (name,
// description, tools, model) e as instruções no corpo; no Codex, um .toml (name, description,
// developer_instructions, model). Pastas de cada um em main/agents/folder.ts.
export type AgentDef = {
  name: string
  // Quando usar: o Claude lê para decidir sozinho se delega para este agente.
  description: string
  // Instruções do agente (o prompt de sistema dele).
  prompt: string
  // Vazio: todas as ferramentas da conversa, MCPs incluídos. Só o Claude escolhe: os nomes das
  // ferramentas mudam de um agente para outro.
  tools?: string[]
  // Vazio: o mesmo modelo da conversa.
  model?: string
  scope: 'global' | 'project'
  // Caminho do arquivo no disco.
  path: string
}

export type AgentSaveRequest = Omit<AgentDef, 'scope' | 'path'> & {
  // Nome antes de editar: renomear apaga o arquivo antigo.
  previousName?: string
}

export type AgentSaveResult = { ok: true; agent: AgentDef } | { ok: false; error: string }

// Subagente trabalhando dentro de uma conversa, enquanto não termina.
export type RunningAgent = {
  // Id da tarefa no Claude Code.
  id: string
  // Chamada da ferramenta Agent que o lançou; liga o agente à linha dele no chat.
  toolUseId?: string
  // Tipo do agente (nome do arquivo .md, ou general-purpose, Explore...).
  agent: string
  // Resumo da tarefa, escrito pelo Claude ao lançar.
  description: string
  startedAt: number
  // O que está fazendo agora, numa frase escrita pelo próprio agente. Até chegar, vale a
  // última ferramenta usada.
  summary?: string
  toolUses: number
  // Últimas ferramentas usadas, da mais antiga para a mais nova.
  steps: { label: string; summary: string }[]
  // Lançado em segundo plano: a conversa segue enquanto ele trabalha.
  background: boolean
}
