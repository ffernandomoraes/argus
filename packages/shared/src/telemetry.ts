// Dados de uso anônimos: o resumo de um dia de uma instalação, mandado ao Worker apps/telemetry (que
// valida de novo o formato). Só números e nomes que não identificam ninguém: sem pastas, títulos,
// conversas, e-mails ou nomes de projeto. Mudou o formato? Suba `v` e ensine o Worker.

// v2 (2026-11-16): recursos usados (features) e o app do celular (phone).
export const TELEMETRY_VERSION = 2;

// Tokens e pedidos de um modelo num dia.
export type ModelUsage = {
  turns: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  // Custo estimado que o próprio Claude Code informa (só Claude; o Codex não informa).
  costUsd: number
};

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
};

export type PhoneUsage = {
  // Minutos com o app do celular aberto na tela.
  minutes: number
  // Vezes que o app abriu ou voltou para a tela.
  opens: number
  features: Record<string, number>
};

// Pedidos (canais de IPC) que contam como uso de um recurso, e o nome que vai no resumo. Só ações
// da pessoa: canais que o app chama sozinho (listar, ler, vigiar) ficam de fora para não inflar.
export const FEATURE_CHANNELS: Record<string, string> = {
  'chat:send': 'message',
  'chat:answer': 'permissionAnswer',
  'chat:interrupt': 'interrupt',
  'chat:configure': 'chatSettings',
  'chat:rename': 'renameChat',
  'chat:restartIn': 'restartChat',
  'sessions:search': 'search',
  'sessions:checkout': 'switchBranch',
  'sessions:pull': 'gitPull',
  'sessions:openRepo': 'openRepo',
  'files:upload': 'attachFile',
  'files:write': 'editFile',
  'files:create': 'createFile',
  'files:rename': 'renameFile',
  'files:trash': 'deleteFile',
  'canvas:addFolder': 'addFolder',
  'canvas:undo': 'undo',
  'boards:rename': 'renameWorkspace',
  'boards:remove': 'removeWorkspace',
  'agents:save': 'globalAgent',
  'canvasAgent:send': 'commandBar',
  'memory:write': 'editMemory',
  'speech:start': 'dictation',
  'transcription:transcribe': 'transcription',
  'mcp:authenticate': 'mcpLogin',
  'projectServers:start': 'startServer',
  'devServers:kill': 'stopServer',
  'popout:open': 'popout',
  'interface:zoom': 'zoom',
  'remoteAccess:startPairing': 'pairDevice',
  'updates:install': 'installUpdate',
  'storage:clean': 'cleanStorage',
  'auth:add': 'addClaudeAccount',
  'providers:add': 'addAgentAccount',
};

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
  // Recursos da interface usados no computador, pelo nome (ver FEATURE_CHANNELS).
  features: Record<string, number>
  // O app do celular ligado a este computador.
  phone: PhoneUsage
  snapshot: TelemetrySnapshot | null
};
