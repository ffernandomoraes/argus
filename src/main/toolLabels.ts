type Input = Record<string, any>

// Como cada ferramenta aparece no chat: o que ela faz (label), para quê (summary)
// e o detalhe técnico (comando, caminho, endereço), que só aparece ao abrir a linha.
export type ToolDescription = { label: string; summary: string; detail?: string }

const LABELS: Record<string, string> = {
  Bash: 'Comando',
  Read: 'Ler',
  Write: 'Criar arquivo',
  Edit: 'Editar',
  MultiEdit: 'Editar',
  NotebookEdit: 'Editar notebook',
  Grep: 'Buscar no código',
  Glob: 'Procurar arquivos',
  WebFetch: 'Abrir página',
  WebSearch: 'Pesquisar na web',
  Agent: 'Subagente',
  Task: 'Subagente',
  TodoWrite: 'Lista de tarefas',
  AskUserQuestion: 'Pergunta',
  Skill: 'Skill',
  ToolSearch: 'Carregar ferramentas',
  TaskStop: 'Parar tarefa',
  ExitPlanMode: 'Plano pronto'
}

const firstLine = (s: unknown) => (typeof s === 'string' ? s.trim().split(/\r?\n/)[0] : '')
// O Claude no Windows manda caminhos com "\".
const fileName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function describeTool(name: string, input: Input | undefined): ToolDescription {
  const i = input ?? {}
  // MCP: "mcp__servidor__acao" vira "servidor - acao".
  if (name.startsWith('mcp__')) {
    const [, server = '', action = ''] = name.split('__')
    const first = Object.values(i).find((v) => typeof v === 'string')
    return { label: `${server} - ${action.replace(/_/g, ' ')}`, summary: firstLine(first) }
  }
  const label = LABELS[name] ?? name
  switch (name) {
    case 'Bash':
      // O Claude Code descreve cada comando ("Listar arquivos da pasta"); sem isso, a 1ª linha do comando.
      return { label, summary: firstLine(i.description) || firstLine(i.command), detail: i.command }
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit': {
      const path = i.file_path ?? i.notebook_path ?? ''
      return { label, summary: fileName(path), detail: path }
    }
    case 'Grep':
      return { label, summary: `“${i.pattern ?? ''}”${i.path ? ` em ${fileName(i.path)}` : ''}`, detail: i.path }
    case 'Glob':
      return { label, summary: i.pattern ?? '', detail: i.path }
    case 'WebFetch':
      return { label, summary: host(i.url ?? ''), detail: i.url }
    case 'WebSearch':
      return { label, summary: i.query ?? '' }
    case 'Agent':
    case 'Task':
      // O pedido inteiro que o subagente recebeu fica no detalhe.
      return { label, summary: firstLine(i.description) || firstLine(i.prompt), detail: i.prompt }
    case 'Skill':
      return { label, summary: i.skill ?? '' }
    case 'TodoWrite':
      return { label, summary: Array.isArray(i.todos) ? `${i.todos.length} itens` : '' }
    case 'AskUserQuestion':
      return { label, summary: firstLine(i.questions?.[0]?.question) }
    default: {
      const value = i.description ?? i.file_path ?? i.command ?? i.pattern ?? i.url ?? i.query ?? i.prompt
      const first = value ?? Object.values(i).find((v) => typeof v === 'string')
      return { label, summary: firstLine(first) }
    }
  }
}
