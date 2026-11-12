import type { BrowserWindow, WebContents } from 'electron'
import type { RemoteConnectionState, RemoteHostInfo } from '../../shared/remote'
import { sendTo, setRemoteWindowCheck } from '../ipc/events'
import { setRemoteBlocked, setRemoteRoute, type CallKind, type RemoteRoute } from '../ipc/register'
import { tr } from '../i18n'
import type { Link } from './link'
import { decodeHost, encode, PROTOCOL_VERSION, type ClientMessage, type HostMessage } from './protocol'
import { TunnelClient } from './tunnelClient'

// O lado do notebook: uma ligação com o Argus de casa e as janelas daqui que mostram ele. O pedido
// dessas janelas não chega aos handlers daqui (ipc/register.ts manda pela rota remota) e o aviso
// que vem de lá vai direto para a janela. As janelas daqui não recebem os avisos locais
// (ipc/events.ts `broadcast`).
//
// Ligação caída com `reconnect`: as janelas ficam abertas ("reconectando") e, quando a ligação
// volta, recarregam: o de casa soltou tudo o que elas seguravam e a página nova pede de novo.

// Pedido síncrono sem resposta nesse tempo: a janela, parada esperando, recebe nulo.
const SYNC_TIMEOUT_MS = 15_000
const HELLO_TIMEOUT_MS = 15_000
// Tentativas de religar: cada vez esperando mais, até desistir.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15_000, 30_000, 30_000, 30_000, 60_000, 60_000]

// Janela daqui (id do webContents) → ligação que ela mostra.
const windowClients = new Map<number, RemoteClient>()
let routing = false

function installRouting(): void {
  if (routing) return
  routing = true
  setRemoteRoute((wc) => windowClients.get(wc.id)?.routeFor(wc.id) ?? null)
  setRemoteWindowCheck((wc) => windowClients.has(wc.id))
  setRemoteBlocked((wc, channel) => sendTo(wc, 'remote:blocked', channel))
}

// O computador que a janela daqui mostra, como está agora (depois de religar, a versão de lá pode ter
// mudado), com a versão deste. Nulo para as janelas comuns.
export function remoteInfoFor(wcId: number): RemoteHostInfo | null {
  const client = windowClients.get(wcId)
  return client?.info ? { ...client.info, clientVersion: client.clientVersion } : null
}

// A ligação que a janela daqui mostra; nula para as janelas comuns.
export function remoteClientOf(wcId: number): RemoteClient | null {
  return windowClients.get(wcId) ?? null
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: NodeJS.Timeout; sync: boolean }

const noConnection = () => new Error(tr('Sem ligação com o outro computador.', 'No connection to the other computer.'))

export class RemoteClient {
  private windows = new Map<number, WebContents>()
  private pending = new Map<number, Pending>()
  private nextId = 1
  private greeting: { resolve: (info: RemoteHostInfo) => void; reject: (e: Error) => void } | null = null
  private _state: RemoteConnectionState = 'connected'
  private link: Link
  private generation = 0
  private ended = false
  // "Abrir localhost": portas daqui que levam ao localhost de lá (ver tunnelClient.ts).
  private tunnels = new TunnelClient((w, ch, args) => {
    if (this._state !== 'connected') return false
    this.post({ t: 'call', w, id: 0, kind: 'send', ch, args })
    return true
  })
  info: RemoteHostInfo | null = null

  constructor(
    link: Link,
    private version: string,
    private name: string,
    private reconnect?: () => Promise<Link>,
    private onEnd?: () => void
  ) {
    this.link = link
    this.bind(link)
  }

  get state(): RemoteConnectionState {
    return this._state
  }

  get clientVersion(): string {
    return this.version
  }

  get windowCount(): number {
    return this.windows.size
  }

  // A primeira janela, para trazer para frente quando pedem para abrir de novo.
  firstWindow(): WebContents | null {
    return this.windows.values().next().value ?? null
  }

  private bind(link: Link): void {
    const generation = ++this.generation
    link.onMessage((data) => generation === this.generation && this.receive(data))
    link.onClose(() => generation === this.generation && this.dropped())
  }

  // Apresenta-se e espera o de casa aceitar (mesma versão) ou recusar, com o motivo.
  connect(): Promise<RemoteHostInfo> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.greeting = null
        reject(new Error(tr('O outro computador não respondeu.', 'The other computer did not answer.')))
        this.link.close()
      }, HELLO_TIMEOUT_MS)
      this.greeting = {
        resolve: (info) => {
          clearTimeout(timer)
          resolve(info)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        }
      }
      this.post({ t: 'hello', protocol: PROTOCOL_VERSION, version: this.version, name: this.name })
    })
  }

  // Uma janela daqui passa a mostrar o Argus de casa. Recarregar ou cair a página lá vira o
  // `did-navigate` da página remota; fechar a janela solta tudo o que ela segurava lá. Fechada a
  // última, a ligação acaba.
  attach(win: BrowserWindow): void {
    installRouting()
    const wc = win.webContents
    const w = wc.id
    this.windows.set(w, wc)
    windowClients.set(w, this)
    this.post({ t: 'open', w })
    wc.on('did-navigate', () => this.post({ t: 'nav', w }))
    wc.on('render-process-gone', () => this.post({ t: 'nav', w }))
    wc.once('destroyed', () => {
      this.tunnels.closeWindow(w)
      this.windows.delete(w)
      windowClients.delete(w)
      this.post({ t: 'close', w })
      if (!this.windows.size) this.close()
    })
  }

  // A porta daqui que leva à `port` do localhost de lá.
  openLocalhost(w: number, port: number): Promise<number> {
    if (this.ended) return Promise.reject(noConnection())
    return this.tunnels.open(w, port)
  }

  routeFor(w: number): RemoteRoute {
    return { call: (kind, channel, args) => this.call(w, kind, channel, args) }
  }

  // Acaba de vez (janelas fechadas, aparelho esquecido): sem religar.
  close(): void {
    if (this.ended) return
    this.ended = true
    this.failPending(true)
    this.link.close()
    this.finish()
  }

  private call(w: number, kind: CallKind, ch: string, args: unknown[]): Promise<unknown> {
    if (this._state !== 'connected') {
      if (kind === 'invoke') return Promise.reject(noConnection())
      return Promise.resolve(null)
    }
    if (kind === 'send') {
      this.post({ t: 'call', w, id: 0, kind, ch, args })
      return Promise.resolve(undefined)
    }
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const p: Pending = { resolve, reject, sync: kind === 'sync' }
      if (p.sync) {
        p.timer = setTimeout(() => {
          this.pending.delete(id)
          console.warn(`[remoto] ${ch} sem resposta em ${SYNC_TIMEOUT_MS} ms`)
          resolve(null)
        }, SYNC_TIMEOUT_MS)
      }
      this.pending.set(id, p)
      this.post({ t: 'call', w, id, kind, ch, args })
    })
  }

  private post(message: ClientMessage): void {
    try {
      this.link.send(encode(message))
    } catch (err) {
      // Argumento que não passa pela cópia do V8: o pedido falha, a ligação segue.
      console.error('[remoto] mensagem não enviada:', err)
      if (message.t === 'call' && message.id) this.settle({ t: 'reply', id: message.id, ok: false, error: String(err) })
    }
  }

  private receive(data: Buffer): void {
    const message = decodeHost(data)
    if (!message) return console.warn('[remoto] mensagem inválida do outro computador')
    switch (message.t) {
      case 'welcome':
        this.info = message.info
        this.greeting?.resolve(message.info)
        this.greeting = null
        return
      case 'reject':
        this.greeting?.reject(new Error(message.reason))
        this.greeting = null
        return
      case 'reply':
        return this.settle(message)
      case 'bye':
        // Desconectado pelo de casa: acaba sem religar.
        this.ended = true
        this.link.close()
        return this.finish('kicked')
      case 'event': {
        // Do "abrir localhost": é daqui do processo principal, não da janela.
        if (message.ch.startsWith('tunnel:')) return this.tunnels.event(message.ch, message.args)
        const wc = this.windows.get(message.w)
        if (wc && !wc.isDestroyed()) wc.send(message.ch, ...message.args)
        return
      }
    }
  }

  private settle(reply: Extract<HostMessage, { t: 'reply' }>): void {
    const p = this.pending.get(reply.id)
    if (!p) return
    this.pending.delete(reply.id)
    clearTimeout(p.timer)
    if (reply.ok) p.resolve(reply.value)
    else if (p.sync) p.resolve(null)
    else p.reject(new Error(reply.error))
  }

  // quiet: encerrado de propósito (janela fechando, aparelho esquecido): quem esperava recebe nulo,
  // sem erro (a janela que fecha não tem a quem mostrar, e o Electron só registraria o erro no log).
  private failPending(quiet = false): void {
    this.greeting?.reject(new Error(tr('A ligação caiu.', 'The connection dropped.')))
    this.greeting = null
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      if (p.sync || quiet) p.resolve(null)
      else p.reject(noConnection())
    }
    this.pending.clear()
  }

  private setState(state: RemoteConnectionState): void {
    this._state = state
    for (const wc of this.windows.values()) sendTo(wc, 'remote:state', state)
  }

  private dropped(): void {
    this.failPending()
    this.tunnels.dropConnections()
    if (this.ended) return
    if (!this.reconnect || !this.windows.size) return this.finish()
    this.setState('reconnecting')
    void this.retry()
  }

  private async retry(): Promise<void> {
    for (const delay of RECONNECT_DELAYS_MS) {
      await new Promise((r) => setTimeout(r, delay))
      if (this.ended || !this.windows.size) return
      let link: Link
      try {
        link = await this.reconnect!()
      } catch {
        continue
      }
      if (this.ended) return void link.close()
      this.link = link
      this.bind(link)
      try {
        await this.connect()
      } catch (err) {
        // Recusado (versão nova de um dos lados, por exemplo): não adianta insistir.
        console.warn('[remoto] religar recusado:', err instanceof Error ? err.message : err)
        link.close()
        return this.finish()
      }
      this._state = 'connected'
      for (const [w, wc] of this.windows) {
        this.post({ t: 'open', w })
        if (!wc.isDestroyed()) wc.reload()
      }
      // Depois do reload: a página nova começa ligada.
      this.setState('connected')
      return
    }
    this.finish()
  }

  private finish(state: 'closed' | 'kicked' = 'closed'): void {
    this.ended = true
    this.failPending()
    this.tunnels.closeAll()
    if (this._state !== 'closed' && this._state !== 'kicked') this.setState(state)
    // As janelas seguem ligadas a esta ligação (encerrada) até fechar: o pedido delas nunca pode cair
    // nos handlers daqui, que mostrariam o Argus deste computador.
    this.onEnd?.()
  }
}
