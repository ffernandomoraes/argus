import { tr } from './i18n'

type Input = Record<string, any>

// Como cada ferramenta aparece no chat: o que ela faz (label), para quê (summary)
// e o detalhe técnico (comando, caminho, endereço), que só aparece ao abrir a linha.
export type ToolDescription = { label: string; summary: string; detail?: string }

// Função, não constante: o idioma pode mudar com o app aberto.
function labels(): Record<string, string> {
  return {
    Bash: tr('Comando', 'Command'),
    Read: tr('Ler', 'Read'),
    Write: tr('Criar arquivo', 'Create file'),
    Edit: tr('Editar', 'Edit'),
    MultiEdit: tr('Editar', 'Edit'),
    NotebookEdit: tr('Editar notebook', 'Edit notebook'),
    Grep: tr('Buscar no código', 'Search code'),
    Glob: tr('Procurar arquivos', 'Find files'),
    WebFetch: tr('Abrir página', 'Open page'),
    WebSearch: tr('Pesquisar na web', 'Search the web'),
    Agent: tr('Subagente', 'Subagent'),
    Task: tr('Subagente', 'Subagent'),
    TodoWrite: tr('Lista de tarefas', 'To-do list'),
    AskUserQuestion: tr('Pergunta', 'Question'),
    Skill: 'Skill',
    ToolSearch: tr('Carregar ferramentas', 'Load tools'),
    TaskStop: tr('Parar tarefa', 'Stop task'),
    ExitPlanMode: tr('Plano pronto', 'Plan ready')
  }
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

// Maior que isso, o .md criado fica só no diff: o texto inteiro iria junto em toda leitura do histórico.
const DOCUMENT_MAX = 200_000

// Texto do arquivo .md que o Claude criou (ou reescreveu inteiro), para o chat mostrar formatado.
export function markdownDocument(name: string, input: Input | undefined): string | undefined {
  const path = input?.file_path
  const content = input?.content
  if (name !== 'Write' || typeof path !== 'string' || !/\.(md|markdown)$/i.test(path)) return undefined
  return typeof content === 'string' && content.length <= DOCUMENT_MAX ? content : undefined
}

export function describeTool(name: string, input: Input | undefined): ToolDescription {
  const i = input ?? {}
  // Terminal do drawer (terminals/drawerShells.ts): o comando à vista, como no Bash.
  if (name === 'mcp__argus__rodar_no_terminal' || name === 'mcp__argus__digitar_no_terminal') {
    const label = name.endsWith('rodar_no_terminal') ? tr('Rodar no terminal', 'Run in terminal') : tr('Digitar no terminal', 'Type in terminal')
    return { label, summary: firstLine(i.comando), detail: i.comando }
  }
  // Etapa delegada pelo orquestrador (orchestration/): o título dela e, ao abrir, o pedido inteiro.
  if (name === 'mcp__argus__delegate') return { label: tr('Delegar', 'Delegate'), summary: firstLine(i.title) || firstLine(i.task), detail: i.task }
  // MCP: "mcp__servidor__acao" vira "servidor - acao".
  if (name.startsWith('mcp__')) {
    const [, server = '', action = ''] = name.split('__')
    const first = Object.values(i).find((v) => typeof v === 'string')
    return { label: `${server} - ${action.replace(/_/g, ' ')}`, summary: firstLine(first) }
  }
  const label = labels()[name] ?? name
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
      return { label, summary: `“${i.pattern ?? ''}”${i.path ? tr(` em ${fileName(i.path)}`, ` in ${fileName(i.path)}`) : ''}`, detail: i.path }
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
      return { label, summary: Array.isArray(i.todos) ? tr(`${i.todos.length} itens`, `${i.todos.length} items`) : '' }
    case 'AskUserQuestion':
      return { label, summary: firstLine(i.questions?.[0]?.question) }
    // O plano inteiro (markdown) no detalhe: o chat mostra formatado. Na linha, o título dele.
    case 'ExitPlanMode':
      return { label, summary: firstLine(i.plan).replace(/^#+\s*/, ''), detail: typeof i.plan === 'string' ? i.plan : undefined }
    default: {
      const value = i.description ?? i.file_path ?? i.command ?? i.pattern ?? i.url ?? i.query ?? i.prompt
      const first = value ?? Object.values(i).find((v) => typeof v === 'string')
      return { label, summary: firstLine(first) }
    }
  }
}
