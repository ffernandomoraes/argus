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

// live: lido da sessão aberta da conversa (dá para reconectar e acompanhar quem está conectando).
// Sem ela, de uma consulta avulsa, que espera todos terminarem de conectar.
export type McpStatus = { ok: true; servers: McpServer[]; live: boolean } | { ok: false; error: string }
