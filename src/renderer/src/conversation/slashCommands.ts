import { tr } from '../i18n'
// Comandos de barra básicos do Claude Code, com descrições traduzidas das do próprio `claude`.
export const SLASH_COMMANDS = [
  { name: 'clear', description: tr('Começa do zero. A conversa anterior fica salva e pode ser retomada.', 'Starts fresh. The previous chat is saved and can be resumed.') },
  { name: 'compact', description: tr('Resume a conversa até aqui para liberar contexto.', 'Summarizes the chat so far to free up context.') },
  { name: 'mcp', description: tr('Mostra os servidores MCP: conectados, com erro e os que precisam de autorização.', 'Shows MCP servers: connected, failed, and those that need authorization.') },
  { name: 'remote-control', description: tr('Continua esta conversa pelo claude.ai ou pelo celular. De novo, desliga.', 'Continues this chat on claude.ai or your phone. Run again to turn off.') }
]

export type SlashCommand = (typeof SLASH_COMMANDS)[number]

// "/cl" → comandos que começam com "cl". Só vale enquanto o texto é "/" + palavra, sem espaço.
// Nenhum comando com esse começo: sem lista, e o Enter envia o texto como está (um comando que o
// app não conhece, como /review, ou um caminho como /Users/...).
export function matchCommands(draft: string): SlashCommand[] | null {
  const m = draft.match(/^\/(\S*)$/)
  if (!m) return null
  const query = m[1].toLowerCase()
  const found = SLASH_COMMANDS.filter((c) => c.name.startsWith(query))
  return found.length ? found : null
}
