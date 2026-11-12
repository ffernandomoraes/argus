import WebSocket from 'ws'
import { tr } from '../i18n'
import type { Link } from './link'

// A ligação com a ponte na internet (o Worker em relay/). Ela só junta as pontas: o que passa por
// aqui vai cifrado por crypto.ts. ARGUS_RELAY_URL troca o endereço (a ponte rodando no
// `wrangler dev`, por exemplo).

const DEFAULT_RELAY = 'wss://argus-relay.fernando-moraes-10e.workers.dev'

export function relayUrl(): string {
  return (process.env.ARGUS_RELAY_URL || DEFAULT_RELAY).replace(/\/+$/, '')
}

// Sem resposta do outro lado neste tempo, a conexão é dada como morta (Wi-Fi trocado, notebook
// dormindo): o WebSocket sozinho só perceberia muito depois.
const PING_MS = 25_000
const PONG_TIMEOUT_MS = 10_000
const CONNECT_TIMEOUT_MS = 15_000

export type RelayFailure = 'offline' | 'unreachable' | 'taken' | 'no-pairing' | 'forbidden'

export class RelayError extends Error {
  constructor(readonly reason: RelayFailure) {
    super(reason)
  }

  get userMessage(): string {
    switch (this.reason) {
      case 'offline':
        return tr('O outro computador está desligado, sem internet ou com o acesso remoto desligado.', 'The other computer is off, offline or has remote access turned off.')
      case 'no-pairing':
        return tr('Nenhum pareamento esperando com esse código. Confira o código ou gere outro.', 'No pairing is waiting with that code. Check the code or generate another one.')
      case 'taken':
        return tr('Esse código já está em uso. Gere outro no computador de casa.', 'That code is already in use. Generate another one on the home computer.')
      case 'forbidden':
        return tr('A ponte recusou a chave deste computador.', 'The relay refused this computer’s key.')
      default:
        return tr('Sem conexão com a ponte do acesso remoto. Confira a internet.', 'Cannot reach the remote access relay. Check the internet connection.')
    }
  }
}

const STATUS_FAILURE: Record<number, RelayFailure> = { 404: 'offline', 409: 'taken', 401: 'forbidden', 403: 'forbidden' }

// Abre o WebSocket; recusa com o motivo que a ponte deu (sala sem o de casa, código ocupado).
function open(path: string, headers?: Record<string, string>, notFound: RelayFailure = 'offline'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${relayUrl()}${path}`, { headers, handshakeTimeout: CONNECT_TIMEOUT_MS, maxPayload: 1024 * 1024 })
    let settled = false
    const fail = (reason: RelayFailure) => {
      if (settled) return
      settled = true
      ws.terminate()
      reject(new RelayError(reason))
    }
    ws.once('unexpected-response', (_req, res) => fail(res.statusCode === 404 ? notFound : (STATUS_FAILURE[res.statusCode ?? 0] ?? 'unreachable')))
    ws.once('error', () => fail('unreachable'))
    ws.once('open', () => {
      if (settled) return
      settled = true
      ws.removeAllListeners('error')
      // Erro depois de aberta vira o fechamento (o 'close' vem logo depois).
      ws.on('error', (err) => console.warn('[remoto] ponte:', err.message))
      keepAlive(ws)
      resolve(ws)
    })
  })
}

function keepAlive(ws: WebSocket): void {
  let waiting: NodeJS.Timeout | null = null
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.ping()
    waiting ??= setTimeout(() => ws.terminate(), PONG_TIMEOUT_MS)
  }, PING_MS)
  ws.on('pong', () => {
    if (waiting) clearTimeout(waiting)
    waiting = null
  })
  ws.once('close', () => {
    clearInterval(timer)
    if (waiting) clearTimeout(waiting)
  })
}

// Um WebSocket como ligação (só mensagens binárias).
function wsLink(ws: WebSocket): Link {
  const closeListeners: (() => void)[] = []
  let closed = false
  const fireClose = () => {
    if (closed) return
    closed = true
    for (const cb of closeListeners) cb()
  }
  ws.once('close', fireClose)
  return {
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    },
    onMessage: (cb) =>
      void ws.on('message', (data, isBinary) => {
        if (isBinary) cb(toBuffer(data))
      }),
    onClose: (cb) => void closeListeners.push(cb),
    close: () => {
      ws.close(1000)
      fireClose()
    }
  }
}

function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (Array.isArray(data)) return Buffer.concat(data)
  return Buffer.from(data)
}

// No notebook: a ligação crua até o Argus de casa (o aperto de mão vem depois).
export async function connectToHost(hostId: string): Promise<Link> {
  return wsLink(await open(`/client/${encodeURIComponent(hostId)}`))
}

// Pareamento: o de casa espera na vaga do código; o notebook entra nela.
export async function connectPairing(nameplate: string, role: 'host' | 'client'): Promise<Link> {
  return wsLink(await open(`/pair/${nameplate}?role=${role}`, undefined, role === 'client' ? 'no-pairing' : 'offline'))
}

export type HostRelayStatus = 'connecting' | 'online' | 'offline'

// No computador de casa: fica ligado à sala dele na ponte enquanto o acesso remoto estiver ligado,
// religando sozinho. Cada aparelho que entra vira uma ligação separada (`onLink`).
export class HostRelay {
  private ws: WebSocket | null = null
  private subs = new Map<number, { deliver: (d: Buffer) => void; end: () => void }>()
  private stopped = true
  private retry: NodeJS.Timeout | null = null
  private delay = 1000
  private _status: HostRelayStatus = 'offline'

  constructor(
    private hostId: string,
    private hostKey: string,
    private onLink: (link: Link, authenticated: () => void) => void,
    private onStatus: (status: HostRelayStatus) => void
  ) {}

  get status(): HostRelayStatus {
    return this._status
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.ws?.close(1000)
    this.ws = null
    this.endAll()
    this.setStatus('offline')
  }

  private setStatus(status: HostRelayStatus): void {
    if (status === this._status) return
    this._status = status
    this.onStatus(status)
  }

  private async connect(): Promise<void> {
    this.setStatus('connecting')
    let ws: WebSocket
    try {
      ws = await open(`/host/${encodeURIComponent(this.hostId)}`, { Authorization: `Bearer ${this.hostKey}` })
    } catch (err) {
      if (err instanceof RelayError && err.reason === 'forbidden') console.error('[remoto] a ponte recusou a chave deste computador')
      return this.later()
    }
    if (this.stopped) return void ws.close(1000)
    this.ws = ws
    this.delay = 1000
    this.setStatus('online')
    ws.on('message', (data, isBinary) => this.receive(toBuffer(data), isBinary))
    ws.once('close', () => {
      if (this.ws === ws) this.ws = null
      this.endAll()
      if (!this.stopped) this.later()
    })
  }

  // Sem internet ou ponte fora: tenta de novo, cada vez esperando mais (até 30 s).
  private later(): void {
    if (this.stopped) return
    this.setStatus('offline')
    this.retry = setTimeout(() => {
      this.retry = null
      void this.connect()
    }, this.delay)
    this.delay = Math.min(this.delay * 2, 30_000)
  }

  private receive(data: Buffer, isBinary: boolean): void {
    if (!isBinary) {
      let m: { t?: unknown; c?: unknown }
      try {
        m = JSON.parse(data.toString('utf8')) as typeof m
      } catch {
        return
      }
      if (typeof m.c !== 'number') return
      if (m.t === 'open') this.open(m.c)
      else if (m.t === 'close') this.subs.get(m.c)?.end()
      return
    }
    if (data.length < 4) return
    this.subs.get(data.readUInt32BE(0))?.deliver(data.subarray(4))
  }

  private open(id: number): void {
    const ws = this.ws
    if (!ws || this.subs.has(id)) return
    const messageListeners: ((d: Buffer) => void)[] = []
    const closeListeners: (() => void)[] = []
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      this.subs.delete(id)
      for (const cb of closeListeners) cb()
    }
    this.subs.set(id, { deliver: (d) => messageListeners.forEach((cb) => cb(d)), end })
    const prefix = Buffer.alloc(4)
    prefix.writeUInt32BE(id)
    this.onLink({
      send: (data) => {
        if (!ended && ws.readyState === WebSocket.OPEN) ws.send(Buffer.concat([prefix, data]))
      },
      onMessage: (cb) => void messageListeners.push(cb),
      onClose: (cb) => void closeListeners.push(cb),
      close: () => {
        if (!ended && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'close', c: id }))
        end()
      }
    }, () => {
      if (!ended && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'auth', c: id }))
    })
  }

  private endAll(): void {
    for (const sub of [...this.subs.values()]) sub.end()
  }
}
