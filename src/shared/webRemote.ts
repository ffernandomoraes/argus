import type { RemoteHostInfo } from './remote'

// Acesso pelo navegador (o app do celular, em mobile/): a mesma ponte e a mesma criptografia do
// acesso remoto entre dois Argus (src/main/remote), mas com mensagens em JSON e uma lista curta do
// que o aparelho pode pedir. O Argus de casa confere a lista: o aparelho web não pede nada fora dela.

// Muda quando as mensagens mudarem de formato.
export const WEB_PROTOCOL_VERSION = 1

// Tipo do aparelho pareado: outro Argus (o notebook) ou o navegador (o celular).
export type DeviceKind = 'app' | 'web'

// Canais que o aparelho web chama e o tipo com que cada um foi registrado (src/main/ipc/register.ts).
export const WEB_CHANNELS = {
  'usage:get': 'invoke',
  'usage:refresh': 'send',
  'auth:state': 'invoke',
  'chat:active': 'invoke',
  'chat:state': 'invoke',
  'chat:interrupted': 'invoke',
  'chat:dismissInterrupted': 'send',
  'chat:send': 'send',
  'chat:answer': 'send',
  'chat:interrupt': 'send',
  'chat:details': 'invoke',
  'chat:configure': 'send',
  'chat:rename': 'invoke',
  'claude:info': 'invoke',
  'providers:state': 'invoke',
  'chat:retain': 'send',
  'chat:release': 'send',
  'sessions:list': 'invoke',
  'sessions:historyPage': 'invoke',
  'sessions:images': 'invoke',
  'sessions:watch': 'send',
  'sessions:search': 'invoke',
  'favorites:get': 'invoke',
  'files:upload': 'invoke',
  'boards:state': 'sync',
  'canvas:load': 'sync'
} as const satisfies Record<string, 'invoke' | 'send' | 'sync'>

export type WebChannel = keyof typeof WEB_CHANNELS

// Avisos que chegam ao aparelho web; o resto (terminais, mascote...) não sai de casa. O canvas
// inteiro (canvas:remote) fica de fora: vem a cada quadro de um arraste; boards:changed já avisa
// quando pastas e conversas mudam.
export const WEB_EVENTS = ['chat:state', 'chat:active', 'chat:interrupted', 'usage:update', 'auth:state', 'sessions:changed', 'boards:changed', 'favorites:changed', 'claude:info', 'providers:state'] as const

export type WebEvent = (typeof WEB_EVENTS)[number]

// Inscrição das notificações do navegador (Web Push), como o PushManager devolve.
export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string }

// Resultado da notificação de teste: enviada, inscrição vencida, falhou ou sem notificação ligada.
export type PushTestResult = 'sent' | 'gone' | 'failed' | 'none'

// O computador de casa, contado ao aparelho web: o de sempre e a chave pública das notificações.
export type WebHostInfo = RemoteHostInfo & { pushKey: string }

export type WebClientMessage =
  | { t: 'hello'; protocol: number }
  | { t: 'call'; id: number; ch: string; args: unknown[] }
  // Notificações ligadas (com a inscrição) ou desligadas (nula).
  | { t: 'push'; sub: WebPushSubscription | null }
  // O app foi para o fundo ou voltou: no fundo, o que acontece vira notificação.
  | { t: 'visible'; on: boolean }
  // "Enviar notificação de teste" (Ajustes): a resposta vem como reply com o resultado.
  | { t: 'pushTest'; id: number }

export type WebHostMessage =
  | { t: 'welcome'; info: WebHostInfo }
  | { t: 'reject'; reason: string }
  | { t: 'reply'; id: number; ok: true; value: unknown }
  | { t: 'reply'; id: number; ok: false; error: string }
  | { t: 'event'; ch: string; args: unknown[] }
  | { t: 'bye' }

// Bytes viajam em JSON como { $b64: "..." } (Uint8Array dos dois lados).
const B64 = '$b64'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// Antes do JSON.stringify: bytes viram o objeto marcado (o Buffer do Node também, que sozinho
// viraria { type: 'Buffer', data: [...] }) e undefined some como no JSON.
function toWire(value: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error('mensagem aninhada demais')
  if (value instanceof Uint8Array) return { [B64]: toBase64(value) }
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : toWire(v, depth + 1)))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = toWire(v, depth + 1)
    return out
  }
  return value
}

export function encodeWeb(message: WebClientMessage | WebHostMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(toWire(message)))
}

// JSON de volta, com os bytes marcados como Uint8Array. Nulo se não for um objeto JSON.
export function decodeWeb(data: Uint8Array): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(data), (_k, v: unknown) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v as Record<string, unknown>
        const keys = Object.keys(o)
        if (keys.length === 1 && keys[0] === B64 && typeof o[B64] === 'string') return fromBase64(o[B64])
      }
      return v
    })
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}
