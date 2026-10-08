import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app, type WebContents } from 'electron'
import WebSocket from 'ws'
import type { SpeechEvent } from '../shared/speech'
import { claudeAccessToken } from './claudeAuth'
import { IS_WIN } from './platform'

// Ditado. Igual à extensão do Claude Code no VS Code: o microfone (native/speech, modo
// "capture") grava e o áudio vai em tempo real para o serviço de voz do Claude, com o login
// do Claude Code. Sem login ou sem conexão, cai no reconhecimento de fala do macOS.
// No Windows, quem grava é a própria janela (ver o preload) e o áudio chega por audio(). Lá não há
// reconhecimento de fala do sistema como reserva: sem o Claude, o ditado avisa e para.
// Um de cada vez: começar um novo descarta o anterior.

const VOICE_URL = 'wss://api.anthropic.com/api/ws/speech_to_text/voice_stream'
const KEEPALIVE = JSON.stringify({ type: 'KeepAlive' })
const CLOSE_STREAM = JSON.stringify({ type: 'CloseStream' })
const KEEPALIVE_MS = 8000
// Depois de parar, quanto esperar o serviço mandar as últimas palavras.
const CLOSE_TIMEOUT_MS = 3000
// Áudio guardado enquanto a conexão abre (5 s em 16 kHz, 16 bits).
const MAX_PENDING_BYTES = 160_000
// Quedas seguidas sem nenhuma palavra antes de desistir.
const MAX_RECONNECTS = 3

// Termos que o serviço deve preferir quando o som for parecido. Os primeiros são os que a
// extensão do VS Code manda; o resto é o vocabulário deste app (inglês no meio do português).
const KEYTERMS = [
  'VS Code', 'IDE', 'webview', 'IntelliSense', 'MCP', 'symlink', 'grep', 'regex', 'localhost', 'codebase',
  'TypeScript', 'JSON', 'OAuth', 'webhook', 'gRPC', 'dotfiles', 'subagent', 'worktree',
  'drawer', 'tooltip', 'card', 'canvas', 'sidebar', 'navbar', 'modal', 'popup', 'popout', 'badge', 'layout',
  'placeholder', 'checkbox', 'dropdown', 'scroll', 'hover', 'drag', 'drop', 'timeline', 'viewport', 'header',
  'footer', 'dark mode', 'light mode', 'design system', 'token', 'front-end', 'back-end', 'Electron', 'React',
  'JavaScript', 'Node', 'Vite', 'Tailwind', 'pnpm', 'npm', 'Claude', 'Claude Code', 'Opus', 'Sonnet', 'Haiku',
  'SDK', 'API', 'CLI', 'GitHub', 'branch', 'merge', 'pull request', 'commit', 'deploy', 'build', 'debug',
  'log', 'diff', 'refactor', 'endpoint', 'cache', 'props', 'hook', 'render', 'prompt', 'markdown', 'thread',
  'workspace', 'feature', 'release', 'terminal', 'shell', 'bash', 'grid', 'flexbox', 'Canva', 'Argus'
]

// Cabeçalho aceito pelo serviço: só ASCII, separado por vírgula, até 1024 caracteres.
function keytermsHeader(terms: string[]): string {
  const out: string[] = []
  let size = 0
  for (const term of new Set(terms.map((t) => t.replace(/,/g, ' ').trim()))) {
    if (!term || !/^[\x20-\x7E]+$/.test(term)) continue
    size += term.length + (out.length ? 1 : 0)
    if (size > 1024) break
    out.push(term)
  }
  return out.join(',')
}

type Send = (event: SpeechEvent) => void
// stop: para de gravar e ainda entrega o fim do texto (até o "done"). abort: descarta tudo.
type Session = { stop: () => void; abort: () => void }

// Microfone: o programa do Mac ou a janela, no Windows. stop: para de gravar. kill: descarta.
type MicEvent = SpeechEvent | { type: 'audio'; chunk: Buffer }
type Mic = { stop: () => void; kill: () => void }
type OpenMic = (onEvent: (e: MicEvent) => void, onExit: (reason: string) => void) => Mic

type HelperEvent = SpeechEvent | { type: 'audio'; data: string }

function spawnHelper(helper: string, args: string[], onEvent: (e: MicEvent) => void, onExit: (reason: string) => void): Mic {
  const proc = spawn(helper, args)
  // Mandar "stop" para um processo que já saiu não pode derrubar o app.
  proc.stdin.on('error', () => {})
  let ended = false
  createInterface({ input: proc.stdout }).on('line', (line) => {
    let event: HelperEvent
    try {
      event = JSON.parse(line) as HelperEvent
    } catch {
      // Linha que não é JSON: ignora.
      return
    }
    if (event.type === 'done' || event.type === 'error') ended = true
    onEvent(event.type === 'audio' ? { type: 'audio', chunk: Buffer.from(event.data, 'base64') } : event)
  })
  // Encerrado sem avisar (ex.: derrubado pelo macOS por falta de permissão).
  proc.on('exit', (code, signal) => !ended && onExit(signal ?? `código ${code}`))
  return {
    stop: () => {
      ended = true
      proc.stdin.end('stop\n')
    },
    kill: () => {
      ended = true
      proc.kill()
    }
  }
}

function join2(a: string, b: string): string {
  return a && b ? `${a} ${b}` : a || b
}

// Reconhecimento de fala do macOS: a reserva.
function appleSession(helper: string, send: Send, warning?: string): Session {
  if (warning) send({ type: 'warning', message: warning })
  const proc = spawnHelper(helper, ['pt-BR'], (e) => e.type !== 'audio' && send(e), (reason) =>
    send({ type: 'error', message: `O ditado foi interrompido (${reason}).` })
  )
  return { stop: proc.stop, abort: proc.kill }
}

// Serviço de voz do Claude. Mesmos parâmetros da extensão do VS Code, em português.
// fallback: o serviço falhou antes da primeira palavra; recebe o motivo.
function claudeSession(openMic: OpenMic, token: string, send: Send, fallback: (reason: string) => void): Session {
  const params = new URLSearchParams({
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    endpointing_ms: '300',
    utterance_end_ms: '1000',
    language: 'pt',
    use_conversation_engine: 'true'
  })
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-app': 'cli',
    'x-config-keyterms': keytermsHeader(KEYTERMS)
  }

  // Frases já fechadas pelo serviço; a atual é revisada até ele fechar.
  let committed = ''
  let current = ''
  let heard = false
  let stopping = false
  let done = false
  let reconnects = 0
  let pending: Buffer[] = []
  let pendingBytes = 0
  let ws: WebSocket
  let keepalive: ReturnType<typeof setInterval> | null = null

  const commit = () => {
    committed = join2(committed, current.trim())
    current = ''
  }

  const finish = () => {
    if (done) return
    done = true
    if (keepalive) clearInterval(keepalive)
    commit()
    send({ type: 'done', text: committed })
    if (ws.readyState !== WebSocket.CLOSED) ws.close()
  }

  const abort = () => {
    done = true
    stopping = true
    if (keepalive) clearInterval(keepalive)
    mic.kill()
    ws.removeAllListeners()
    ws.on('error', () => {})
    ws.terminate()
  }

  const fail = (message: string) => {
    abort()
    send({ type: 'error', message })
  }

  const connect = () => {
    ws = new WebSocket(`${VOICE_URL}?${params}`, { headers })
    ws.on('open', () => {
      ws.send(KEEPALIVE)
      for (const chunk of pending) ws.send(chunk)
      pending = []
      pendingBytes = 0
      if (keepalive) clearInterval(keepalive)
      keepalive = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(KEEPALIVE), KEEPALIVE_MS)
      if (stopping) ws.send(CLOSE_STREAM)
    })
    ws.on('message', (raw) => {
      let msg: { type?: string; data?: string; description?: string; message?: string }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.type === 'TranscriptInterim' || msg.type === 'TranscriptText') {
        if (!msg.data) return
        heard = true
        reconnects = 0
        current = msg.data
        send({ type: 'text', text: join2(committed, current.trim()) })
      } else if (msg.type === 'TranscriptEndpoint') {
        commit()
      } else if (msg.type === 'TranscriptError' || msg.type === 'error') {
        console.warn('[speech]', msg.description ?? msg.message)
      }
    })
    ws.on('error', (err) => {
      const status = /^Unexpected server response: (\d+)/.exec(err.message)?.[1]
      // Antes da primeira palavra, qualquer falha vira o ditado do Mac: melhor que nada.
      if (!heard && !stopping) {
        abort()
        fallback(status === '401' || status === '403' ? 'login do Claude recusado' : `sem conexão (${status ?? err.message})`)
      }
    })
    ws.on('close', () => {
      if (done) return
      commit()
      if (stopping) return finish()
      // O serviço fechou com o microfone ainda ligado: abre de novo e continua o texto.
      if (++reconnects > MAX_RECONNECTS) return fail('A transcrição do Claude caiu e não voltou.')
      setTimeout(() => !done && connect(), 250)
    })
  }

  const mic = openMic(
    (e) => {
      if (e.type === 'audio') {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.chunk)
        else if (pendingBytes < MAX_PENDING_BYTES) {
          pending.push(e.chunk)
          pendingBytes += e.chunk.length
        }
      } else if (e.type === 'error') fail(e.message)
      else send(e)
    },
    (reason) => !stopping && fail(`O microfone foi interrompido (${reason}).`)
  )
  connect()

  return {
    stop: () => {
      if (stopping) return
      stopping = true
      mic.stop()
      // Pede ao serviço o fim do texto; se não fechar a tempo, entrega o que tem.
      if (ws.readyState === WebSocket.OPEN) ws.send(CLOSE_STREAM)
      setTimeout(finish, CLOSE_TIMEOUT_MS)
    },
    abort
  }
}

export class Speech {
  private session: Session | null = null
  private seq = 0
  // Windows: a janela que está gravando e para onde vai o áudio dela.
  private target: WebContents | null = null
  private feed: ((chunk: Buffer) => void) | null = null

  start(target: WebContents): void {
    const previous = this.target
    this.abort()
    const seq = this.seq
    // Sessão descartada não fala mais com a tela.
    const send: Send = (event) => seq === this.seq && !target.isDestroyed() && target.send('speech:event', event)
    if (IS_WIN) {
      // Ditado começado em outra janela: a anterior desliga o microfone dela (no Mac, o programa
      // que grava é encerrado no abort).
      if (previous && previous !== target && !previous.isDestroyed()) previous.send('speech:micStop')
      this.target = target
      // Daqui em diante, fim e erro que chegarem são desta sessão (ver preload/winMic.ts).
      target.send('speech:started')
      return this.startWindows(seq, send)
    }

    // Empacotado, vem fora do app.asar (de dentro dele não dá para executar).
    const helper = app.isPackaged
      ? join(process.resourcesPath, 'speech-helper')
      : join(app.getAppPath(), 'native/speech/build/speech-helper')
    if (!existsSync(helper)) {
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
  // guardado e entra na sessão quando ela abre.
  private startWindows(seq: number, send: Send): void {
    let early: Buffer[] = []
    let earlyBytes = 0
    this.feed = (chunk) => {
      if (earlyBytes >= MAX_PENDING_BYTES) return
      early.push(chunk)
      earlyBytes += chunk.length
    }
    void claudeAccessToken().then((token) => {
      if (seq !== this.seq || this.session) return
      if (!token) {
        this.feed = null
        send({ type: 'error', message: 'O ditado usa a transcrição do Claude: entre no Claude Code para usar.' })
        return
      }
      const openMic: OpenMic = (onEvent) => {
        const flush = early
        early = []
        // Depois de a sessão terminar de montar: o primeiro áudio já encontra a conexão criada.
        queueMicrotask(() => flush.forEach((chunk) => onEvent({ type: 'audio', chunk })))
        this.feed = (chunk) => onEvent({ type: 'audio', chunk })
        const off = () => (this.feed = null)
        return { stop: off, kill: off }
      }
      this.session = claudeSession(openMic, token, send, (why) =>
        send({ type: 'error', message: `A transcrição do Claude não está disponível (${why}).` })
      )
    })
  }

  // Windows: um pedaço do áudio gravado pela janela (16 kHz, mono, 16 bits). Só vale o da janela
  // que começou o ditado.
  audio(from: WebContents, chunk: Buffer): void {
    if (from === this.target) this.feed?.(chunk)
  }

  // Para de gravar; o fim do texto ainda chega.
  stop(): void {
    if (this.session) this.session.stop()
    else {
      // Ainda buscando o login: não há o que entregar.
      this.seq++
      this.feed = null
    }
  }

  private abort(): void {
    this.seq++
    this.feed = null
    this.session?.abort()
    this.session = null
  }
}
