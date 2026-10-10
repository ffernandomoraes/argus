// Agente do Claude Code: um arquivo .md com cabeçalho (name, description, tools, model) e as
// instruções no corpo. Globais em ~/.claude/agents; de um projeto, em <pasta>/.claude/agents.
export type AgentDef = {
  name: string
  // Quando usar: o Claude lê para decidir sozinho se delega para este agente.
  description: string
  // Instruções do agente (o prompt de sistema dele).
  prompt: string
  // Vazio: todas as ferramentas da conversa, MCPs incluídos.
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
