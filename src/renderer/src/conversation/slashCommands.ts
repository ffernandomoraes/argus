// Comandos de barra básicos do Claude Code, com descrições traduzidas das do próprio `claude`.
export const SLASH_COMMANDS = [
  { name: 'clear', description: 'Começa do zero. A conversa anterior fica salva e pode ser retomada.' },
  { name: 'compact', description: 'Resume a conversa até aqui para liberar contexto.' },
  { name: 'context', description: 'Mostra quanto do contexto está em uso.' },
  { name: 'usage', description: 'Mostra o custo da sessão e o uso do plano.' },
  { name: 'mcp', description: 'Mostra os servidores MCP: conectados, com erro e os que precisam de autorização.' },
  { name: 'init', description: 'Cria o CLAUDE.md com a documentação do projeto.' },
  { name: 'rename', description: 'Renomeia a conversa.' },
  { name: 'remote-control', description: 'Continua esta conversa pelo claude.ai ou pelo celular. De novo, desliga.' }
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
