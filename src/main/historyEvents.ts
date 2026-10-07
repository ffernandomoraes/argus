import type { Message } from '../shared/history'

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type EventMessage = Extract<Message, { role: 'event' }>

// "claude-opus-5-5" → "Opus 5.5"; "claude-haiku-4-5-20251001" → "Haiku 4.5".
export function modelName(id: string): string {
  const clean = id.replace(/\x1b\[[0-9;]*m/g, '').replace(/[`*]/g, '').trim()
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?/.exec(clean)
  if (!m) return clean
  const family = m[1][0].toUpperCase() + m[1].slice(1)
  return `${family} ${m[2]}${m[3] ? '.' + m[3] : ''}${m[4] ? ' (1M)' : ''}`
}

const thousand = (n: number) => `${Math.round(n / 1000).toLocaleString('pt-BR')} mil`

// Compactação: o Claude Code grava uma linha "compact_boundary" com o tamanho de antes.
export function compactEvent(l: Line): EventMessage | null {
  if (l.type !== 'system' || l.subtype !== 'compact_boundary') return null
  const meta = l.compactMetadata ?? {}
  const how = meta.trigger === 'auto' ? 'Conversa compactada automaticamente' : 'Conversa compactada'
  const before = typeof meta.preTokens === 'number' ? ` (tinha ${thousand(meta.preTokens)} tokens)` : ''
  return { id: l.uuid, role: 'event', kind: 'compact', text: how + before, at: l.timestamp }
}

// "/rename teste": o Claude Code grava o comando e os argumentos em marcadores próprios.
export function commandMessage(l: Line): Message | null {
  if (l.type !== 'user' || typeof l.message?.content !== 'string') return null
  const name = /<command-name>\/?([\w:-]+)<\/command-name>/.exec(l.message.content)?.[1]
  if (!name) return null
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(l.message.content)?.[1]?.trim()
  return { id: l.uuid, role: 'user', text: `/${name}${args ? ` ${args}` : ''}`, at: l.timestamp }
}

// A resposta de um comando vem numa linha de sistema ("local_command"); em sessões
// antigas ela vinha como mensagem do usuário.
function localOutput(l: Line): string | null {
  const raw = l.type === 'system' ? l.content : l.type === 'user' ? l.message?.content : null
  if (typeof raw !== 'string') return null
  return /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/.exec(raw)?.[1]?.trim() || null
}

// O que o comando respondeu.
export function commandOutput(l: Line): Message | null {
  const out = localOutput(l)
  return out ? { id: l.uuid, role: 'output', text: out, at: l.timestamp } : null
}

// Resposta dos comandos /model e /effort, gravada como mensagem com <local-command-stdout>.
export function commandEvent(l: Line): EventMessage | null {
  const out = localOutput(l)
  if (!out) return null
  const model = /^Set model to (.+?)(?: and saved.*)?$/m.exec(out)?.[1]
  if (model) return { id: l.uuid, role: 'event', kind: 'model', text: `Modelo: ${modelName(model)}`, at: l.timestamp }
  const effort = /^Set effort level to (\w+)/m.exec(out)?.[1]
  if (effort) return { id: l.uuid, role: 'event', kind: 'effort', text: `Esforço: ${effort}`, at: l.timestamp }
  return null
}
