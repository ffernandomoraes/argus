import { deserialize, serialize } from 'node:v8'
import type { RemoteHostInfo } from '@argus/shared/remote'
import type { CallKind } from '../ipc/register'

// Mensagens entre o Argus que mostra (o "cliente", no notebook) e o que hospeda (o "de casa").
// Vão em bytes pela ligação (src/main/remote/link.ts), no formato de cópia do V8: o mesmo que o
// IPC do Electron usa entre a janela e o processo principal (objetos, listas, Float32Array,
// undefined), então o que passa pelo IPC passa por aqui.
//
// `w` é a janela do cliente (o id do webContents dela lá): uma ligação leva várias janelas.

// Muda quando as mensagens mudarem de formato.
export const PROTOCOL_VERSION = 1

export type ClientMessage =
  | { t: 'hello'; protocol: number; version: string; name: string }
  | { t: 'open'; w: number }
  | { t: 'nav'; w: number }
  | { t: 'close'; w: number }
  | { t: 'call'; w: number; id: number; kind: CallKind; ch: string; args: unknown[] }

export type HostMessage =
  | { t: 'welcome'; info: RemoteHostInfo }
  | { t: 'reject'; reason: string }
  | { t: 'reply'; id: number; ok: true; value: unknown }
  | { t: 'reply'; id: number; ok: false; error: string }
  | { t: 'event'; w: number; ch: string; args: unknown[] }
  // O de casa desconectou este aparelho de propósito: não adianta religar.
  | { t: 'bye' }

export function encode(message: ClientMessage | HostMessage): Buffer {
  return serialize(message)
}

const isInt = (v: unknown): v is number => Number.isSafeInteger(v)
const isText = (v: unknown): v is string => typeof v === 'string'
const KINDS: readonly unknown[] = ['invoke', 'send', 'sync'] satisfies CallKind[]

// O que chega do cliente é conferido campo a campo: só passa a mensagem no formato esperado.
export function decodeClient(data: Buffer): ClientMessage | null {
  let m: Record<string, unknown>
  try {
    const value: unknown = deserialize(data)
    if (!value || typeof value !== 'object') return null
    m = value as Record<string, unknown>
  } catch {
    return null
  }
  switch (m.t) {
    case 'hello':
      return isInt(m.protocol) && isText(m.version) && isText(m.name) ? { t: 'hello', protocol: m.protocol, version: m.version, name: m.name } : null
    case 'open':
    case 'nav':
    case 'close':
      return isInt(m.w) ? { t: m.t, w: m.w } : null
    case 'call':
      return isInt(m.w) && isInt(m.id) && KINDS.includes(m.kind) && isText(m.ch) && Array.isArray(m.args)
        ? { t: 'call', w: m.w, id: m.id, kind: m.kind as CallKind, ch: m.ch, args: m.args }
        : null
    default:
      return null
  }
}

export function decodeHost(data: Buffer): HostMessage | null {
  try {
    const value: unknown = deserialize(data)
    if (!value || typeof value !== 'object') return null
    const m = value as Record<string, unknown>
    if (m.t === 'welcome' && m.info && typeof m.info === 'object') return m as HostMessage
    if (m.t === 'reject' && isText(m.reason)) return m as HostMessage
    if (m.t === 'reply' && isInt(m.id) && typeof m.ok === 'boolean') return m as HostMessage
    if (m.t === 'event' && isInt(m.w) && isText(m.ch) && Array.isArray(m.args)) return m as HostMessage
    if (m.t === 'bye') return { t: 'bye' }
    return null
  } catch {
    return null
  }
}
