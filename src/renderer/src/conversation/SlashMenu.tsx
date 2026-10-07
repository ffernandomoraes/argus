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
export function matchCommands(draft: string): SlashCommand[] | null {
  const m = draft.match(/^\/(\S*)$/)
  if (!m) return null
  const query = m[1].toLowerCase()
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(query))
}

export function SlashMenu({
  items,
  active,
  onHover,
  onSelect
}: {
  items: SlashCommand[]
  active: number
  onHover: (index: number) => void
  onSelect: (command: SlashCommand) => void
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/30">
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-xs text-faint">Nenhum comando encontrado</div>
      ) : (
        items.map((c, i) => (
          <button
            key={c.name}
            // mousedown: escolher sem tirar o foco do campo de texto
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(c)
            }}
            onMouseEnter={() => onHover(i)}
            className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left ${i === active ? 'bg-surface-2' : ''}`}
          >
            <span className="w-28 shrink-0 font-mono text-xs text-text">/{c.name}</span>
            <span className="truncate text-[11px] text-faint">{c.description}</span>
          </button>
        ))
      )}
    </div>
  )
}
