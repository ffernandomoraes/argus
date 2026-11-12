import type { RemoteHostInfo } from '../../shared/remote'
import { addRemotePage, removeRemotePage } from '../ipc/events'
import { dispatch, type CallKind } from '../ipc/register'
import { tr } from '../i18n'
import type { Link } from './link'
import { decodeClient, encode, PROTOCOL_VERSION, type ClientMessage, type HostMessage } from './protocol'
import { RemotePage } from './remotePage'

// O lado do Argus de casa: cada ligação que chega (um notebook) abre uma sessão. Cada janela do
// notebook vira uma RemotePage daqui, que recebe os avisos como as janelas locais, e os pedidos
// dela passam pelos mesmos handlers (ipc/register.ts `dispatch`), só os canais liberados para o
// acesso remoto (remote/policy.ts).

export class RemoteHost {
  private sessions = new Set<HostSession>()

  constructor(private info: () => RemoteHostInfo) {}

  accept(link: Link): HostSession {
    const session = new HostSession(link, this.info, () => this.sessions.delete(session))
    this.sessions.add(session)
    return session
  }

  get connections(): number {
    return this.sessions.size
  }

  closeAll(): void {
    for (const s of [...this.sessions]) s.close()
  }
}

export class HostSession {
  private pages = new Map<number, RemotePage>()
  private greeted = false
  private ended = false

  constructor(
    private link: Link,
    private info: () => RemoteHostInfo,
    private onEnd: () => void
  ) {
    link.onMessage((data) => this.receive(data))
    link.onClose(() => this.end())
  }

  close(): void {
    this.link.close()
    this.end()
  }

  // Desconectado daqui (Desconectar, Remover): o aparelho fica sabendo e não tenta religar.
  kick(): void {
    this.send({ t: 'bye' })
    this.close()
  }

  private send(message: HostMessage): void {
    if (this.ended) return
    try {
      this.link.send(encode(message))
    } catch (err) {
      // Valor que não passa pela cópia do V8 (uma função, por exemplo): o pedido recebe o erro.
      if (message.t === 'reply') this.link.send(encode({ t: 'reply', id: message.id, ok: false, error: String(err) }))
      else console.error('[remoto] aviso não enviado:', err)
    }
  }

  private receive(data: Buffer): void {
    const message = decodeClient(data)
    if (!message) {
      console.warn('[remoto] mensagem inválida; ligação encerrada')
      return this.close()
    }
    if (!this.greeted && message.t !== 'hello') return this.close()
    this.handle(message)
  }

  private handle(m: ClientMessage): void {
    switch (m.t) {
      case 'hello':
        return this.hello(m.protocol, m.version)
      case 'open':
        return this.open(m.w)
      case 'nav':
        return this.pages.get(m.w)?.navigated()
      case 'close':
        return this.closePage(m.w)
      case 'call':
        return void this.call(m.w, m.id, m.kind, m.ch, m.args)
    }
  }

  private hello(protocol: number, version: string): void {
    const info = this.info()
    // As duas pontas precisam da mesma versão: os canais (src/shared/ipc.ts) mudam entre versões.
    if (protocol !== PROTOCOL_VERSION || version !== info.version) {
      this.send({
        t: 'reject',
        reason: tr(
          `Versões diferentes: este Argus está na ${info.version} e o seu na ${version}. Atualize os dois para a mesma versão.`,
          `Different versions: this Argus is on ${info.version} and yours on ${version}. Update both to the same version.`
        )
      })
      return this.close()
    }
    this.greeted = true
    this.send({ t: 'welcome', info })
  }

  private open(w: number): void {
    if (this.pages.has(w)) return
    const page = new RemotePage((ch, args) => this.send({ t: 'event', w, ch, args }))
    this.pages.set(w, page)
    addRemotePage(page)
  }

  private closePage(w: number): void {
    const page = this.pages.get(w)
    if (!page) return
    this.pages.delete(w)
    removeRemotePage(page)
    page.destroy()
  }

  private async call(w: number, id: number, kind: CallKind, ch: string, args: unknown[]): Promise<void> {
    const page = this.pages.get(w)
    try {
      if (!page) throw new Error(`Janela ${w} desconhecida.`)
      const value = await dispatch(kind, ch, { sender: page }, args)
      if (kind !== 'send') this.send({ t: 'reply', id, ok: true, value })
    } catch (err) {
      if (kind !== 'send') this.send({ t: 'reply', id, ok: false, error: err instanceof Error ? err.message : String(err) })
      else console.error(`[remoto] erro em ${ch}:`, err)
    }
  }

  private end(): void {
    if (this.ended) return
    this.ended = true
    for (const w of [...this.pages.keys()]) this.closePage(w)
    this.onEnd()
  }
}
