import WebSocket from 'ws'
import { KEYTERMS, keytermsHeader } from './keyterms'
import { MAX_PENDING_BYTES, type OpenMic, type Send, type Session } from './types'

// Serviço de voz do Claude: o áudio vai em tempo real por WebSocket, com o login do Claude Code,
// e as frases voltam enquanto a pessoa fala. Mesmos parâmetros da extensão do VS Code, em português.

const VOICE_URL = 'wss://api.anthropic.com/api/ws/speech_to_text/voice_stream'
const KEEPALIVE = JSON.stringify({ type: 'KeepAlive' })
const CLOSE_STREAM = JSON.stringify({ type: 'CloseStream' })
const KEEPALIVE_MS = 8000
// Depois de parar, quanto esperar o serviço mandar as últimas palavras.
const CLOSE_TIMEOUT_MS = 3000
// Quedas seguidas sem nenhuma palavra antes de desistir.
const MAX_RECONNECTS = 3

function join2(a: string, b: string): string {
  return a && b ? `${a} ${b}` : a || b
}

// fallback: o serviço falhou antes da primeira palavra; recebe o motivo.
export function claudeSession(openMic: OpenMic, token: string, send: Send, fallback: (reason: string) => void): Session {
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
