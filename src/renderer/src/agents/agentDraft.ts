import type { AgentDef, AgentSaveRequest } from '../../../shared/agents'

// Ferramentas do Claude Code que dá para marcar uma a uma. Outras (MCPs, por exemplo) vão no
// campo de texto, pelo nome completo.
export const TOOLS = [
  { name: 'Read', label: 'Ler arquivos' },
  { name: 'Grep', label: 'Buscar no código' },
  { name: 'Glob', label: 'Procurar arquivos' },
  { name: 'Edit', label: 'Editar' },
  { name: 'Write', label: 'Criar arquivos' },
  { name: 'Bash', label: 'Rodar comandos' },
  { name: 'WebFetch', label: 'Abrir páginas' },
  { name: 'WebSearch', label: 'Pesquisar na web' },
  { name: 'TodoWrite', label: 'Lista de tarefas' },
  { name: 'Skill', label: 'Usar skills' }
]
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))

export const MODELS = [
  { value: '', label: 'O mesmo da conversa' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
]

// Criar um agente vai passo a passo; um agente salvo abre com os passos livres, como abas.
export const STEPS = ['Instruções', 'Ferramentas e modelo']
export const LAST_STEP = STEPS.length - 1

export type Draft = {
  name: string
  description: string
  prompt: string
  model: string
  allTools: boolean
  tools: string[]
  // Ferramentas fora da lista, separadas por vírgula.
  extraTools: string
  // Nome salvo no disco; vazio = agente novo.
  previousName?: string
}

export const EMPTY_DRAFT: Draft = { name: '', description: '', prompt: '', model: '', allTools: true, tools: [], extraTools: '' }

export function toDraft(a: AgentDef): Draft {
  const tools = a.tools ?? []
  return {
    name: a.name,
    description: a.description,
    prompt: a.prompt,
    model: a.model ?? '',
    allTools: !a.tools,
    tools: tools.filter((t) => TOOL_NAMES.has(t)),
    extraTools: tools.filter((t) => !TOOL_NAMES.has(t)).join(', '),
    previousName: a.name
  }
}

function toolList(d: Draft): string[] | undefined {
  if (d.allTools) return undefined
  const extra = d.extraTools
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return [...d.tools, ...extra]
}

export const toSaveRequest = (d: Draft): AgentSaveRequest => ({
  name: d.name,
  description: d.description,
  prompt: d.prompt,
  model: d.model || undefined,
  tools: toolList(d),
  previousName: d.previousName
})

// Campos obrigatórios ainda vazios, com o nome que aparece na tela.
export function missing(d: Draft): string[] {
  return [!d.name.trim() && 'nome', !d.description.trim() && 'quando usar', !d.prompt.trim() && 'instruções'].filter(
    (m): m is string => !!m
  )
}

// Rascunho igual ao de quando abriu (nada para salvar).
export const sameDraft = (a: Draft | null, b: Draft | null): boolean => JSON.stringify(a) === JSON.stringify(b)

export const toggleTool = (d: Draft, name: string): Draft => ({
  ...d,
  tools: d.tools.includes(name) ? d.tools.filter((t) => t !== name) : [...d.tools, name]
})
