import type { Message } from '../../shared/history'
import { atOf, contentOf, idOf, num, obj, type Line } from '../transcripts/line'

type EventMessage = Extract<Message, { role: 'event' }>

// "claude-opus-5-5" → "Opus 5.5"; "claude-haiku-4-5-20251001" → "Haiku 4.5";
// "claude-opus-4-20250514" → "Opus 4": a data não é versão (o "(?!\d)" impede ler "20" como ".20").
export function modelName(id: string): string {
  const clean = id.replace(/\x1b\[[0-9;]*m/g, '').replace(/[`*]/g, '').trim()
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2})(?!\d))?(?:-\d{8})?(\[1m\])?/.exec(clean)
  if (!m) return clean
  const family = m[1][0].toUpperCase() + m[1].slice(1)
  return `${family} ${m[2]}${m[3] ? '.' + m[3] : ''}${m[4] ? ' (1M)' : ''}`
}

const thousand = (n: number) => `${Math.round(n / 1000).toLocaleString('pt-BR')} mil`

// Compactação: o Claude Code grava uma linha "compact_boundary" com o tamanho de antes.
export function compactEvent(l: Line): EventMessage | null {
  if (l.type !== 'system' || l.subtype !== 'compact_boundary') return null
  const meta = obj(l.compactMetadata) ?? {}
  const how = meta.trigger === 'auto' ? 'Conversa compactada automaticamente' : 'Conversa compactada'
  const tokens = num(meta.preTokens)
  const before = tokens !== undefined ? ` (tinha ${thousand(tokens)} tokens)` : ''
  return { id: idOf(l), role: 'event', kind: 'compact', text: how + before, at: atOf(l) }
}

// Parada pelo botão: o Claude Code grava "[Request interrupted by user]" (ou "... for tool use")
// como mensagem sua, em texto ou numa parte de texto.
export function interruptEvent(l: Line): EventMessage | null {
  if (l.type !== 'user') return null
  const content = contentOf(l)
  const parts = typeof content === 'string' ? [content] : (Array.isArray(content) ? content : []).map((c) => obj(c)?.text)
  if (!parts.some((t) => typeof t === 'string' && /^\[Request interrupted by user[^\]]*\]$/.test(t.trim()))) return null
  return { id: idOf(l), role: 'event', kind: 'interrupted', text: 'Você parou o Claude aqui', at: atOf(l) }
}

// "/rename teste": o Claude Code grava o comando e os argumentos em marcadores próprios.
export function commandMessage(l: Line): Message | null {
  const content = contentOf(l)
  if (l.type !== 'user' || typeof content !== 'string') return null
  const name = /<command-name>\/?([\w:-]+)<\/command-name>/.exec(content)?.[1]
  if (!name) return null
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(content)?.[1]?.trim()
  return { id: idOf(l), role: 'user', text: `/${name}${args ? ` ${args}` : ''}`, at: atOf(l) }
}

// A resposta de um comando vem numa linha de sistema ("local_command"); em sessões
// antigas ela vinha como mensagem do usuário.
function localOutput(l: Line): string | null {
  const raw = l.type === 'system' ? l.content : l.type === 'user' ? contentOf(l) : null
  if (typeof raw !== 'string') return null
  return /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/.exec(raw)?.[1]?.trim() || null
}

// O que o comando respondeu.
export function commandOutput(l: Line): Message | null {
  const out = localOutput(l)
  return out ? { id: idOf(l), role: 'output', text: out, at: atOf(l) } : null
}

// Resposta dos comandos /model e /effort, gravada como mensagem com <local-command-stdout>.
export function commandEvent(l: Line): EventMessage | null {
  const out = localOutput(l)
  if (!out) return null
  const model = /^Set model to (.+?)(?: and saved.*)?$/m.exec(out)?.[1]
  if (model) return { id: idOf(l), role: 'event', kind: 'model', text: `Modelo: ${modelName(model)}`, at: atOf(l) }
  const effort = /^Set effort level to (\w+)/m.exec(out)?.[1]
  if (effort) return { id: idOf(l), role: 'event', kind: 'effort', text: `Esforço: ${effort}`, at: atOf(l) }
  return null
}
