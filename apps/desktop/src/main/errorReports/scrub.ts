import { homedir, userInfo } from 'node:os'
import type { Breadcrumb, ErrorEvent } from '@sentry/electron/main'

// O que sai da máquina num relatório de erro: nada que identifique a pessoa. O nome do usuário sai
// dos caminhos (C:\Users\ana\..., /Users/ana/..., /home/ana/..., e a pasta do Linux do WSL vista
// pelo Windows), e-mails viram <email>, textos longos são cortados. Conteúdo de conversa e de
// arquivo não chega aqui (as variáveis das funções não são coletadas; ver index.ts), mas uma
// mensagem de erro pode citar um caminho, e o corte vale para ela também.

const USER = '<user>'
const MAX_TEXT = 2000
const MAX_BREADCRUMB = 500

// O nome do usuário sozinho, além de nos caminhos (uma mensagem "sem permissão para ana"). Nomes
// curtos demais apagariam pedaços de palavras.
function ownName(): string | null {
  try {
    const name = userInfo().username
    return name.length >= 3 ? name : null
  } catch {
    return null
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NAME = ownName()
const PATTERNS: [RegExp, string][] = [
  // A pasta do usuário como está nesta máquina, em qualquer separador ("C:\Users\ana", "C:/Users/ana").
  [new RegExp(escape(homedir()).replace(/\\\\/g, '[\\\\/]'), 'gi'), homedir().replace(/[^\\/]+$/, USER)],
  // Windows (inclusive o /mnt/c do WSL e o caminho em URL file:///C:/Users/ana).
  [/((?:[A-Za-z]:|\/mnt\/[a-z])[\\/](?:Users|Documents and Settings)[\\/])[^\\/\s"'<>:|?*]+/gi, `$1${USER}`],
  // Mac.
  [/(\/Users\/)[^/\s"'<>:]+/g, `$1${USER}`],
  // Linux e a pasta do Linux do WSL vista pelo Windows (\\wsl.localhost\Ubuntu\home\ana).
  [/([\\/]home[\\/])[^\\/\s"'<>:]+/g, `$1${USER}`],
  // Termina em letras ("ana@gmail.com"), para não pegar versão de pacote ("core@11.8.0").
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g, '<email>'],
  ...(NAME ? ([[new RegExp(`(?<![\\w.-])${escape(NAME)}(?![\\w-])`, 'gi'), USER]] as [RegExp, string][]) : [])
]

export function scrubText(text: string, max = MAX_TEXT): string {
  let out = text
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out.length > max ? `${out.slice(0, max)}…` : out
}

// Troca todo texto do objeto, em qualquer profundidade, pela versão limpa. As chaves também: um
// caminho pode virar chave (o mapa de arquivos das pilhas, por exemplo).
function scrubDeep(value: unknown, max: number, depth = 0): unknown {
  if (typeof value === 'string') return scrubText(value, max)
  if (depth > 12 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, max, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[scrubText(k, max)] = scrubDeep(v, max, depth + 1)
  return out
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const clean = scrubDeep(event, MAX_TEXT) as ErrorEvent
  // O nome da máquina costuma ter o da pessoa ("PC-da-Ana").
  delete clean.server_name
  if (clean.contexts?.device) delete clean.contexts.device.name
  return clean
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubDeep(breadcrumb, MAX_BREADCRUMB) as Breadcrumb
}
