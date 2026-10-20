// Servidor MCP visto pelo Claude Code na pasta do projeto.
export type McpServer = {
  name: string
  // connected: funcionando. needs-auth: falta autorizar. failed: não conectou.
  // pending: conectando. disabled: desligado nas configurações.
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  // Quantas ferramentas ele oferece (só quando conectado).
  tools: number
  error?: string
  // Onde ele está configurado: user, project, local, claudeai, dynamic (plugin), managed...
  scope?: string
  // Quem o trouxe: plugin, sdk ou o mesmo do scope. Plugin vem com scope "dynamic".
  source?: string
  version?: string
  // Servidor web com login próprio (http/sse): dá para desconectar a conta dele. Os conectores do
  // claude.ai se desconectam no site.
  signOut: boolean
}

// Onde dá para remover um servidor (`claude mcp remove`): os adicionados no Claude Code. Os do
// claude.ai saem no site; os de plugin, desligando o plugin.
export const REMOVABLE_SCOPES = ['user', 'local', 'project']

// live: lido da sessão aberta da conversa (dá para reconectar e acompanhar quem está conectando).
// Sem ela, de uma consulta avulsa, que espera todos terminarem de conectar.
// "Autorizar" de um servidor: o link abriu no navegador. manualReconnect: conector do claude.ai, que
// se autoriza no site e não avisa o Claude; ao voltar para o app, é preciso reconectar.
export type McpAuthResult = { ok: true; manualReconnect: boolean } | { ok: false; error: string }

export type McpStatus = { ok: true; servers: McpServer[]; live: boolean } | { ok: false; error: string }
