import type { McpServer } from '../../../shared/mcp'
import { tr } from '../i18n'

// De onde veio cada servidor, em palavras. A chave é o scope (ou o source, para plugin).
const ORIGIN: Record<string, string> = {
  user: tr('Adicionado no Claude Code - vale em todas as pastas', 'Added in Claude Code - applies to every folder'),
  claudeai: tr('Conector do claude.ai', 'claude.ai connector'),
  project: tr('Do projeto - .mcp.json desta pasta', 'From the project - this folder’s .mcp.json'),
  local: tr('Só nesta pasta', 'Only in this folder'),
  managed: tr('Da empresa', 'From your organization'),
  enterprise: tr('Da empresa', 'From your organization'),
  sdk: 'Argus',
  agent: tr('De um agente', 'From an agent')
}

// Nome para mostrar e a origem, sem o prefixo que o Claude Code põe no nome: "claude.ai Asana" vira
// "Asana" e "plugin:vercel:vercel" vira "vercel" (origem: plugin vercel). O nome de verdade continua
// sendo o usado nas ações.
export function serverLabel(server: McpServer): { name: string; origin?: string } {
  const plugin = server.source === 'plugin' ? server.name.match(/^plugin:([^:]+):(.+)$/) : null
  if (plugin) return { name: plugin[2], origin: tr(`Do plugin ${plugin[1]}`, `From the ${plugin[1]} plugin`) }
  if (server.source === 'plugin') return { name: server.name, origin: tr('De um plugin', 'From a plugin') }
  const name = server.scope === 'claudeai' ? server.name.replace(/^claude\.ai /, '') : server.name
  return { name, origin: ORIGIN[server.scope ?? ''] ?? server.scope }
}
