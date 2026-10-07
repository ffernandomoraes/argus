// Servidor MCP visto pelo Claude Code na pasta do projeto.
export type McpServer = {
  name: string
  // connected: funcionando. needs-auth: falta autorizar. failed: não conectou.
  // pending: conectando. disabled: desligado nas configurações.
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  // Quantas ferramentas ele oferece (só quando conectado).
  tools: number
  error?: string
  // Onde ele está configurado (usuário, projeto, plugin...).
  scope?: string
  version?: string
}

export type McpStatus = { ok: true; servers: McpServer[] } | { ok: false; error: string }
