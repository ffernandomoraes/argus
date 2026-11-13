// Dados de uso anônimos: o resumo de um dia de uma instalação, mandado ao Worker apps/telemetry (que
// valida de novo o formato). Só números e nomes que não identificam ninguém: sem pastas, títulos,
// conversas, e-mails ou nomes de projeto. Mudou o formato? Suba `v` e ensine o Worker.

export const TELEMETRY_VERSION = 1

// Tokens e pedidos de um modelo num dia.
export type ModelUsage = {
  turns: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  // Custo estimado que o próprio Claude Code informa (só Claude; o Codex não informa).
  costUsd: number
}

// Quanto a pessoa tem no Argus agora (não só o que fez no dia).
export type TelemetrySnapshot = {
  workspaces: number
  folders: number
  worktrees: number
  groups: number
  chatCards: number
  terminals: number
  notes: number
  claudeAccounts: number
  // Plano de cada conta do Claude ("pro", "max", "team"...; "api" para quem paga por uso).
  claudePlans: Record<string, number>
  // Agentes com alguma conta conectada (codex, gemini, cursor).
  providers: string[]
  remoteAccess: boolean
}

export type DailyReport = {
  v: number
  installId: string
  // Dia local da pessoa, AAAA-MM-DD.
  day: string
  app: {
    version: string
    os: 'macos' | 'windows' | 'linux'
    osVersion: string
    arch: string
    language: string
    wsl: boolean
    claudeCode: string | null
  }
  time: {
    // Janela do Argus em foco ou alguma conversa rodando.
    activeMinutes: number
    focusedMinutes: number
    runningMinutes: number
  }
  counts: {
    appOpens: number
    workspacesCreated: number
    worktreesCreated: number
    // Por agente: claude, codex, gemini, cursor.
    chatsCreated: Record<string, number>
    messagesSent: Record<string, number>
  }
  // Chave "agente:modelo", ex.: "claude:claude-opus-5-5".
  models: Record<string, ModelUsage>
  // Ferramentas chamadas pelo Claude, só o nome (Bash, Edit...). As de MCP viram "mcp".
  tools: Record<string, number>
  snapshot: TelemetrySnapshot | null
}
