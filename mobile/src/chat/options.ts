import { FilePen, Hand, ListChecks, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react'
import type { ClaudeModel } from '../../../src/shared/models'
import type { ChatSettings } from '../../../src/shared/chat'
import { tr } from '../i18n'

// Cópia das opções da conversa do Argus (src/renderer/src/conversation/modelOptions.ts e
// permissionModes.ts): as de lá dependem do window.api do Electron. Mudou lá, mude aqui.

export const DEFAULT_SETTINGS: ChatSettings = { model: '', effort: '', thinking: false, ultracode: false, permissionMode: '' }

export const EFFORTS = [
  { value: 'low', label: tr('Baixo', 'Low') },
  { value: 'medium', label: tr('Médio', 'Medium') },
  { value: 'high', label: tr('Alto', 'High') },
  { value: 'xhigh', label: tr('Muito alto', 'Extra high') },
  { value: 'max', label: tr('Máximo', 'Max') }
]

export const effortLabel = (value: string) => EFFORTS.find((e) => e.value === value)?.label ?? 'Auto'

export function familyOf(name: string): string {
  if (name.includes(' ')) return name.split(' ')[0]
  const words: string[] = []
  for (const part of name.split('-')) {
    if (/^\d/.test(part)) break
    words.push(part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
  }
  return words.join(' ') || name
}

export function groupByFamily(models: ClaudeModel[]): [string, ClaudeModel[]][] {
  const families = new Map<string, ClaudeModel[]>()
  for (const m of models) {
    if (m.value === '') continue
    const family = familyOf(m.displayName)
    families.set(family, [...(families.get(family) ?? []), m])
  }
  return [...families.entries()]
}

export const MODES: { value: string; label: string; description: string; icon: LucideIcon; danger?: boolean }[] = [
  { value: 'manual', label: 'Manual', description: tr('Pede aprovação antes de cada edição.', 'Asks for approval before each edit.'), icon: Hand },
  { value: 'acceptEdits', label: tr('Editar automaticamente', 'Edit automatically'), description: tr('Edita os arquivos sem pedir aprovação.', 'Edits files without asking for approval.'), icon: FilePen },
  { value: 'plan', label: tr('Plano', 'Plan'), description: tr('Explora o código e apresenta um plano antes de editar.', 'Explores the code and presents a plan before editing.'), icon: ListChecks },
  {
    value: 'auto',
    label: 'Auto',
    description: tr('Aprova o que passa numa checagem de segurança e para no que for arriscado.', 'Approves what passes a safety check and stops on anything risky.'),
    icon: ShieldCheck
  },
  {
    value: 'bypassPermissions',
    label: tr('Ignorar permissões', 'Bypass permissions'),
    description: tr('Não pede aprovação nem para comandos potencialmente perigosos.', 'Doesn’t ask for approval, even for potentially dangerous commands.'),
    icon: ShieldOff,
    danger: true
  }
]

// Comandos de barra que o celular oferece (os do Argus que fazem sentido aqui).
export const COMMANDS = [
  { name: 'compact', description: tr('Resume a conversa até aqui para liberar contexto.', 'Summarizes the chat so far to free up context.') },
  { name: 'clear', description: tr('Começa uma conversa nova nesta pasta. A atual fica salva.', 'Starts a new chat in this folder. The current one is saved.') },
  { name: 'rename', description: tr('Renomeia a conversa.', 'Renames the chat.') }
] as const

// Preferências de cada conversa guardadas neste aparelho (como a janela do Argus faz): a conta
// escolhida e o modelo/esforço/modo. Conversa aberta no Argus vale o que ela usa de verdade.
type Prefs = { account?: string; settings?: ChatSettings }
const key = (id: string) => `argus-chat:${id}`

export function loadPrefs(id: string): Prefs {
  try {
    return JSON.parse(localStorage.getItem(key(id)) ?? '{}') as Prefs
  } catch {
    return {}
  }
}

export function savePrefs(id: string, patch: Prefs): void {
  try {
    localStorage.setItem(key(id), JSON.stringify({ ...loadPrefs(id), ...patch }))
  } catch {
    // sem armazenamento: vale até fechar a página
  }
}

// Conversa nova ganhou a sessão: o que foi escolhido antes vai junto.
export function movePrefs(from: string, to: string): void {
  const saved = loadPrefs(from)
  if (!Object.keys(saved).length) return
  savePrefs(to, saved)
  try {
    localStorage.removeItem(key(from))
  } catch {
    // nada
  }
}
