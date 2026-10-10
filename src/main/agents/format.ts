import type { AgentDef, AgentSaveRequest } from '../../shared/agents'

// O arquivo .md de um agente: cabeçalho (name, description, tools, model) e as instruções no
// corpo. Lógica pura.

// Valor do cabeçalho: entre aspas (como o app grava) ou cru (como muita gente escreve à mão).
function scalar(raw: string): string {
  const v = raw.trim()
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v)
    } catch {
      // aspas mal fechadas: segue cru
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")
  return v
}

export function parseAgent(raw: string, path: string, scope: AgentDef['scope']): AgentDef | null {
  // Arquivo editado no Windows vem com \r\n.
  const text = raw.replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const head: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (kv) head[kv[1]] = scalar(kv[2])
  }
  if (!head.name) return null
  const tools = head.tools
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    name: head.name,
    description: head.description ?? '',
    prompt: m[2].trim(),
    tools: tools?.length ? tools : undefined,
    model: head.model && head.model !== 'inherit' ? head.model : undefined,
    scope,
    path
  }
}

// Aspas duplas no padrão JSON são YAML válido: descrição com ":" ou "#" não quebra o cabeçalho.
// Ferramentas e modelo vão crus, cada um numa linha (ver saveAgent, que recusa quebra de linha).
export function serializeAgent(a: AgentSaveRequest): string {
  const head = [
    `name: ${a.name}`,
    `description: ${JSON.stringify(a.description.replace(/\s*\n\s*/g, ' ').trim())}`,
    ...(a.tools?.length ? [`tools: ${a.tools.join(', ')}`] : []),
    ...(a.model ? [`model: ${a.model}`] : [])
  ]
  return `---\n${head.join('\n')}\n---\n\n${a.prompt.trim()}\n`
}
