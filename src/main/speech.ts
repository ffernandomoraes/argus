import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app, type WebContents } from 'electron'
import WebSocket from 'ws'
import type { SpeechEvent } from '../shared/speech'
import { claudeAccessToken } from './claudeAuth'

// Ditado. Igual à extensão do Claude Code no VS Code: o microfone (native/speech, modo
// "capture") grava e o áudio vai em tempo real para o serviço de voz do Claude, com o login
// do Claude Code. Sem login ou sem conexão, cai no reconhecimento de fala do macOS.
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

type HelperEvent = SpeechEvent | { type: 'audio'; data: string }

function spawnHelper(helper: string, args: string[], onEvent: (e: HelperEvent) => void, onExit: (reason: string) => void) {
  const proc = spawn(helper, args)
  // Mandar "stop" para um processo que já saiu não pode derrubar o app.
  proc.stdin.on('error', () => {})
  let ended = false
  createInterface({ input: proc.stdout }).on('line', (line) => {
    try {
      const event = JSON.parse(line) as HelperEvent
      if (event.type === 'done' || event.type === 'error') ended = true
      onEvent(event)
    } catch {
      // Linha que não é JSON: ignora.
    }
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
function claudeSession(helper: string, token: string, send: Send, fallback: (reason: string) => void): Session {
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
        const why = status === '401' || status === '403' ? 'login do Claude recusado' : `sem conexão (${status ?? err.message})`
        fallback(`Transcrição do Claude indisponível (${why}); usando o ditado do Mac, que erra mais.`)
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

  const mic = spawnHelper(
    helper,
    ['capture'],
    (e) => {
      if (e.type === 'audio') {
        const chunk = Buffer.from(e.data, 'base64')
        if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
        else if (pendingBytes < MAX_PENDING_BYTES) {
          pending.push(chunk)
          pendingBytes += chunk.length
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

  start(target: WebContents): void {
    this.abort()
    const seq = this.seq
    // Sessão descartada não fala mais com a tela.
    const send: Send = (event) => seq === this.seq && !target.isDestroyed() && target.send('speech:event', event)

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
      this.session = claudeSession(helper, token, send, (reason) => {
        if (seq === this.seq) this.session = appleSession(helper, send, reason)
      })
    })
  }

  // Para de gravar; o fim do texto ainda chega.
  stop(): void {
    if (this.session) this.session.stop()
    // Ainda buscando o login: não há o que entregar.
    else this.seq++
  }

  private abort(): void {
    this.seq++
    this.session?.abort()
    this.session = null
  }
}
