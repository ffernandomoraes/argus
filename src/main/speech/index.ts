import type { WebContents } from 'electron'
import { claudeAccessToken } from '../claudeAuth'
import { sendTo } from '../ipc/events'
import { IS_WIN } from '../platform'
import { claudeSession } from './claudeSession'
import { appleSession, helperPath, spawnHelper } from './helper'
import type { OpenMic, Send, Session } from './types'
import { watchWindow } from './watchWindow'
import { WindowFeed } from './windowFeed'

// Ditado. Igual à extensão do Claude Code no VS Code: o microfone (native/speech, modo
// "capture") grava e o áudio vai em tempo real para o serviço de voz do Claude, com o login
// do Claude Code. Sem login ou sem conexão, cai no reconhecimento de fala do macOS.
// No Windows, quem grava é a própria janela (ver o preload) e o áudio chega por audio(). Lá não há
// reconhecimento de fala do sistema como reserva: sem o Claude, o ditado avisa e para.
// Um de cada vez: começar um novo descarta o anterior. Esta classe é a dona da sessão: sabe de
// que janela ela é e a encerra quando a janela fecha, recarrega ou cai.
export class Speech {
  private session: Session | null = null
  private seq = 0
  // A janela do ditado atual (nos dois sistemas). No Windows, a única cujo áudio vale.
  private target: WebContents | null = null
  private feed: WindowFeed | null = null
  private unwatch: (() => void) | null = null

  start(target: WebContents): void {
    const previous = this.target
    this.abort()
    const seq = this.seq
    // Sessão descartada não fala mais com a tela.
    const send: Send = (event) => {
      if (seq === this.seq) sendTo(target, 'speech:event', event)
    }
    // Ditado começado em outra janela: a anterior sai de "ouvindo" (o "done" sem texto não mexe no
    // campo dela) e, no Windows, desliga o microfone dela. No Mac, o programa que grava já foi
    // encerrado no abort.
    if (previous && previous !== target) {
      if (IS_WIN) sendTo(previous, 'speech:micStop')
      sendTo(previous, 'speech:event', { type: 'done', text: '' })
    }
    this.target = target
    this.unwatch = watchWindow(target, () => {
      if (seq !== this.seq) return
      this.abort()
      this.target = null
    })
    if (IS_WIN) {
      // Daqui em diante, fim e erro que chegarem são desta sessão (ver preload/winMic).
      sendTo(target, 'speech:started')
      return this.startWindows(seq, send)
    }
    this.startMac(seq, send)
  }

  private startMac(seq: number, send: Send): void {
    const helper = helperPath()
    if (!helper) {
      send({ type: 'error', message: 'Ditado não instalado. Rode `pnpm install` para compilar.' })
      return
    }
    void claudeAccessToken().then((token) => {
      // Parado ou recomeçado enquanto buscava o login.
      if (seq !== this.seq || this.session) return
      if (!token) {
        this.session = appleSession(helper, send, 'Sem login no Claude Code; usando o ditado do Mac, que erra mais.')
        return
      }
      const openMic: OpenMic = (onEvent, onExit) => spawnHelper(helper, ['capture'], onEvent, onExit)
      this.session = claudeSession(openMic, token, send, (why) => {
        const reason = `Transcrição do Claude indisponível (${why}); usando o ditado do Mac, que erra mais.`
        if (seq === this.seq) this.session = appleSession(helper, send, reason)
      })
    })
  }

  // A janela já está gravando quando isto roda: o áudio que chega enquanto o login é lido fica
  // guardado e entra na sessão quando ela abre (ver WindowFeed).
  private startWindows(seq: number, send: Send): void {
    const feed = new WindowFeed()
    this.feed = feed
    void claudeAccessToken().then((token) => {
      if (seq !== this.seq || this.session) return
      if (!token) {
        feed.close()
        send({ type: 'error', message: 'O ditado usa a transcrição do Claude: entre no Claude Code para usar.' })
        return
      }
      this.session = claudeSession(feed.open, token, send, (why) =>
        send({ type: 'error', message: `A transcrição do Claude não está disponível (${why}).` })
      )
    })
  }

  // Windows: um pedaço do áudio gravado pela janela (16 kHz, mono, 16 bits). Só vale o da janela
  // que começou o ditado.
  audio(from: WebContents, chunk: Buffer): void {
    if (from === this.target) this.feed?.push(chunk)
  }

  // Para de gravar; o fim do texto ainda chega. from: a janela que pediu. Pedido de outra janela
  // que não a dona é ignorado (ex.: um ditado antigo que ainda achava estar ouvindo); sem from
  // (saída do app), vale sempre.
  stop(from?: WebContents): void {
    if (from && from !== this.target) return
    if (this.session) this.session.stop()
    else {
      // Ainda buscando o login: não há o que entregar.
      this.seq++
      this.feed?.close()
      this.feed = null
    }
  }

  private abort(): void {
    this.seq++
    this.feed?.close()
    this.feed = null
    this.session?.abort()
    this.session = null
    this.unwatch?.()
    this.unwatch = null
  }
}
