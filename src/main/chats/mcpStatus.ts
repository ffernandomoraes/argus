import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { McpServer } from '../../shared/mcp'
import { claudeCodeOptions } from './env'
import { Inbox } from './inbox'

function toMcpServers(raw: Awaited<ReturnType<Query['mcpServerStatus']>>): McpServer[] {
  return raw
    .map((m) => ({
      name: m.name,
      status: m.status,
      tools: m.tools?.length ?? 0,
      error: m.error,
      scope: m.scope,
      version: m.serverInfo?.version
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Logo depois de abrir, vários servidores ainda estão conectando. Pergunta de novo até
// ninguém ficar em "conectando", ou até cansar de esperar.
const MCP_SETTLE_MS = 10_000
const MCP_RETRY_MS = 400

export async function mcpServersOf(q: Query): Promise<McpServer[]> {
  const ask = (): Promise<McpServer[]> => q.mcpServerStatus().then(toMcpServers)
  const deadline = Date.now() + MCP_SETTLE_MS
  let last = await ask()
  while (last.some((m) => m.status === 'pending') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, MCP_RETRY_MS))
    last = await ask()
  }
  return last
}

// Status dos MCPs sem conversa aberta: sobe um `claude` só para perguntar e o encerra.
// Os servidores dependem da pasta e da conta, por isso não dá para usar um processo genérico.
export async function mcpStatusFor(cwd: string, account?: string): Promise<McpServer[]> {
  const inbox = new Inbox()
  const q = query({ prompt: inbox, options: { ...claudeCodeOptions(cwd, account), persistSession: false } })
  try {
    return await mcpServersOf(q)
  } finally {
    inbox.close()
    q.close()
  }
}
