import {
  decodeWeb,
  encodeWeb,
  WEB_PROTOCOL_VERSION,
  type PushTestResult,
  type WebChannel,
  type WebClientMessage,
  type WebHostInfo,
  type WebPushSubscription
} from '../../../src/shared/webRemote'
import type { EventChannels, InvokeChannels, SendChannels, SendSyncChannels } from '../../../src/shared/ipc'
import { tr } from '../i18n'
import { clearCache } from '../lib/cache'
import { parsePairCode, type Link } from './crypto'
import { HandshakeError, openSession, pairAsClient } from './handshake'

// A ligação do app do celular com o Argus de casa, pela ponte: abre, cifra (handshake.ts), religa
// sozinha quando cai e entrega pedidos e avisos às telas.

export type PairedHost = { hostId: string; hostName: string; deviceId: string; psk: string }

const STORE_KEY = 'argus-paired-host'

const b64 = (b: Uint8Array) => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}
const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0))

export function loadPairedHost(): PairedHost | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<PairedHost>
    return typeof v.hostId === 'string' && typeof v.deviceId === 'string' && typeof v.psk === 'string' && typeof v.hostName === 'string'
      ? (v as PairedHost)
      : null
  } catch {
    return null
  }
}

function savePairedHost(host: PairedHost | null): void {
  try {
    if (host) localStorage.setItem(STORE_KEY, JSON.stringify(host))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    // Sem armazenamento: o pareamento vale até fechar a página.
  }
}

// A ponte publicada; no pnpm mobile:dev a página roda no localhost e fala com ela (ou com a de
// VITE_RELAY_URL, como a do `wrangler dev`).
const PUBLISHED_RELAY = 'wss://remote.argusterm.com'

// A ponte: a mesma origem da página (ela serve o app).
export function relayBase(): string {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined
  if (env) return env.replace(/\/+$/, '')
  if (import.meta.env.DEV) return PUBLISHED_RELAY
  return location.origin.replace(/^http/, 'ws')
}

class SocketClosed extends Error {
  constructor(readonly code: number) {
    super(`closed ${code}`)
  }
}

// WebSocket como Link. Recusado pela ponte (sem o de casa, código ocupado) só aparece como erro: o
// navegador não conta o status da resposta.
function openSocket(url: string, timeoutMs = 15_000): Promise<Link> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    let opened = false
    const messageListeners: ((d: Uint8Array) => void)[] = []
    const closeListeners: (() => void)[] = []
    const timer = setTimeout(() => {
      if (!opened) {
        ws.close()
        reject(new SocketClosed(0))
      }
    }, timeoutMs)
    ws.onopen = () => {
      opened = true
      clearTimeout(timer)
      resolve({
        send: (d) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(d as Uint8Array<ArrayBuffer>)
        },
        onMessage: (cb) => void messageListeners.push(cb),
        onClose: (cb) => void closeListeners.push(cb),
        close: () => ws.close()
      })
    }
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) for (const cb of messageListeners) cb(new Uint8Array(e.data))
    }
    let closedOnce = false
    ws.onclose = (e) => {
      clearTimeout(timer)
      if (!opened) return reject(new SocketClosed(e.code))
      if (closedOnce) return
      closedOnce = true
      for (const cb of closeListeners) cb()
    }
    ws.onerror = () => {
      // O close vem logo depois.
    }
  })
}

function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  return tr('Navegador', 'Browser')
}

function pairFailure(err: unknown): string {
  if (err instanceof HandshakeError) {
    if (err.reason === 'wrong-code') return tr('Código errado. Gere um código novo no computador e tente de novo.', 'Wrong code. Generate a new code on the computer and try again.')
    if (err.reason === 'closed') return tr('O computador não respondeu a tempo. Gere um código novo.', 'The computer did not answer in time. Generate a new code.')
    return tr('O computador respondeu fora do esperado.', 'The computer answered unexpectedly.')
  }
  if (err instanceof SocketClosed)
    return tr(
      'Nenhum pareamento esperando com esse código. Confira o código ou gere outro no computador.',
      'No pairing is waiting with that code. Check it or generate another one on the computer.'
    )
  return err instanceof Error ? err.message : String(err)
}

// Pareia com o código do computador (Configurações > Acesso remoto). Erro em texto, ou nulo.
export async function pairWithCode(text: string): Promise<string | null> {
  const code = parsePairCode(text)
  if (!code) return tr('O código tem 5 letras e números, um hífen e 6 números, como K7Q4M-913776.', 'The code has 5 letters and digits, a hyphen and 6 digits, like K7Q4M-913776.')
  let raw: Link
  try {
    raw = await openSocket(`${relayBase()}/pair/${code.nameplate}?role=client`)
  } catch (err) {
    return pairFailure(err)
  }
  try {
    const granted = await pairAsClient(raw, code, deviceName())
    savePairedHost({ hostId: granted.hostId, hostName: granted.hostName, deviceId: granted.deviceId, psk: b64(granted.psk) })
    return null
  } catch (err) {
    return pairFailure(err)
  } finally {
    raw.close()
  }
}

export function forgetPairedHost(): void {
  savePairedHost(null)
  clearCache()
}

// --- A conexão com o computador pareado ---

// connecting: abrindo ou religando. offline: o de casa não responde (desligado, dormindo, sem
// internet ou com o acesso desligado). rejected: versões que não conversam. kicked: o de casa
// desconectou este aparelho. unpaired: o de casa não conhece mais este aparelho.
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'rejected' | 'kicked' | 'unpaired'

type Args<C> = C extends keyof InvokeChannels
  ? Parameters<InvokeChannels[C]>
  : C extends keyof SendChannels
    ? Parameters<SendChannels[C]>
    : C extends keyof SendSyncChannels
      ? Parameters<SendSyncChannels[C]>
      : never
type Result<C> = C extends keyof InvokeChannels
  ? Awaited<ReturnType<InvokeChannels[C]>>
  : C extends keyof SendSyncChannels
    ? ReturnType<SendSyncChannels[C]>
    : void

type Listener = (...args: never[]) => void

// Entre as tentativas de religar. Curto: sem ligação a tela fica bloqueada, e cada tentativa é só
// abrir um WebSocket.
const RETRY_MS = [1000, 2000, 3000, 5000]
const CALL_TIMEOUT_MS = 30_000

export class HostConnection {
  status: ConnectionStatus = 'connecting'
  info: WebHostInfo | null = null
  // Motivo do status, para a tela (versão diferente, por exemplo).
  detail: string | null = null
  private link: Link | null = null
  private ready = false
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private listeners = new Map<string, Set<Listener>>()
  private statusListeners = new Set<() => void>()
  private attempts = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private connecting = false
  private visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  private waiters: (() => void)[] = []

  constructor(readonly host: PairedHost) {}

  start(): void {
    this.stopped = false
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.link?.close()
  }

  onStatus(cb: () => void): () => void {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }

  private setStatus(status: ConnectionStatus, detail: string | null = null): void {
    this.status = status
    this.detail = detail
    for (const cb of this.statusListeners) cb()
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.connecting || this.link) return
    this.connecting = true
    if (this.status !== 'online') this.setStatus('connecting')
    try {
      const raw = await openSocket(`${relayBase()}/client/${this.host.hostId}`)
      const link = await openSession(raw, this.host.deviceId, unb64(this.host.psk))
      this.link = link
      link.onMessage((d) => this.receive(d))
      link.onClose(() => this.dropped(link))
      this.post({ t: 'hello', protocol: WEB_PROTOCOL_VERSION })
    } catch (err) {
      if (err instanceof HandshakeError && (err.reason === 'unknown-device' || err.reason === 'bad-key')) {
        this.setStatus('unpaired')
      } else {
        this.setStatus('offline')
        this.scheduleRetry()
      }
    } finally {
      this.connecting = false
    }
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return
    const delay = RETRY_MS[Math.min(this.attempts++, RETRY_MS.length - 1)]
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.connect()
    }, delay)
  }

  // Voltou para a tela: religa na hora (o celular pode ter derrubado a ligação no fundo) e confere se
  // a que parece aberta ainda responde.
  wake(): void {
    if (this.stopped || this.status === 'unpaired' || this.status === 'kicked') return
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.attempts = 0
    if (!this.link) return void this.connect()
    const link = this.link
    this.call('chat:active').catch(() => {
      if (this.link === link) link.close()
    })
  }

  setVisible(on: boolean): void {
    this.visible = on
    if (this.ready) this.post({ t: 'visible', on })
    if (on) this.wake()
  }

  setPush(sub: WebPushSubscription | null): void {
    this.post({ t: 'push', sub })
  }

  // O computador manda uma notificação de teste para este aparelho.
  async testPush(): Promise<PushTestResult> {
    await this.whenReady()
    const id = this.nextId++
    return new Promise<PushTestResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(tr('O computador não respondeu.', 'The computer did not answer.')))
      }, CALL_TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.post({ t: 'pushTest', id })
    })
  }

  private dropped(link: Link): void {
    if (this.link !== link) return
    this.link = null
    this.ready = false
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error(tr('A ligação com o computador caiu.', 'The connection to the computer dropped.')))
    }
    this.pending.clear()
    if (this.status === 'rejected' || this.status === 'kicked') return
    this.setStatus('offline')
    this.scheduleRetry()
  }

  private post(m: WebClientMessage): void {
    this.link?.send(encodeWeb(m))
  }

  private receive(data: Uint8Array): void {
    const m = decodeWeb(data)
    if (!m) return
    switch (m.t) {
      case 'welcome':
        this.info = m.info as WebHostInfo
        this.ready = true
        this.attempts = 0
        this.post({ t: 'visible', on: this.visible })
        this.setStatus('online')
        this.waiters.splice(0).forEach((w) => w())
        return
      case 'reject':
        this.setStatus('rejected', typeof m.reason === 'string' ? m.reason : null)
        return
      case 'bye':
        this.setStatus('kicked')
        return
      case 'reply': {
        const p = this.pending.get(m.id as number)
        if (!p) return
        this.pending.delete(m.id as number)
        clearTimeout(p.timer)
        if (m.ok) p.resolve(m.value)
        else p.reject(new Error(typeof m.error === 'string' ? m.error : 'erro'))
        return
      }
      case 'event': {
        const set = this.listeners.get(m.ch as string)
        if (set && Array.isArray(m.args)) for (const cb of set) (cb as (...a: unknown[]) => void)(...m.args)
        return
      }
    }
  }

  // Espera a ligação ficar pronta (até o prazo do pedido).
  private whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(tr('Sem ligação com o computador.', 'No connection to the computer.'))), CALL_TIMEOUT_MS)
      this.waiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  // Um canal da lista liberada (WEB_CHANNELS). Os sem resposta também confirmam a entrega.
  async call<C extends WebChannel>(ch: C, ...args: Args<C>): Promise<Result<C>> {
    await this.whenReady()
    const id = this.nextId++
    return new Promise<Result<C>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(tr('O computador não respondeu.', 'The computer did not answer.')))
      }, CALL_TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.post({ t: 'call', id, ch, args: args as unknown[] })
    })
  }

  on<E extends keyof EventChannels>(event: E, cb: EventChannels[E]): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>()
    set.add(cb as Listener)
    this.listeners.set(event, set)
    return () => set.delete(cb as Listener)
  }
}
