import { ipcRenderer } from 'electron'
import type { SpeechEvent } from '../shared/speech'

// Microfone do ditado no Windows. No Mac quem grava é o programa native/speech; aqui é a própria
// janela, pelo navegador. Entrega o mesmo que ele: o áudio em 16 kHz, mono, 16 bits (para o processo
// principal, que manda ao serviço de voz do Claude), o volume para as ondas e o "ready".

const SAMPLE_RATE = 16_000
// 1024 amostras a 16 kHz: um pedaço a cada 64 ms, perto do ritmo do volume no Mac.
const CHUNK = 1024

type Listener = (event: SpeechEvent) => void
const listeners = new Set<Listener>()
const emit = (event: SpeechEvent) => listeners.forEach((l) => l(event))

let running: { stop: () => void } | null = null
// Cada start ganha um número: parar enquanto o microfone abre cancela a abertura.
let seq = 0
// O processo principal já recebeu o último start? Antes disso, um fim ou erro que chegue é do
// ditado anterior (que ainda estava fechando) e não pode desligar o microfone deste.
let acked = true

function micError(err: unknown): string {
  const name = (err as DOMException | undefined)?.name
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Nenhum microfone encontrado.'
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'O Windows bloqueou o microfone para o Argus. Libere em Configurações › Privacidade e segurança › Microfone.'
  }
  if (name === 'NotReadableError') return 'O microfone está em uso por outro programa.'
  return `Não deu para abrir o microfone (${(err as Error | undefined)?.message ?? String(err)}).`
}

// -50 dB (silêncio) a 0 dB (muito alto) vira 0 a 1, como no programa do Mac.
function level(sumSquares: number, count: number): number {
  const rms = Math.sqrt(sumSquares / count)
  const db = 20 * Math.log10(Math.max(rms, 0.000_001))
  return Math.min(1, Math.max(0, (db + 50) / 50))
}

// Liga o microfone e grava. O áudio sai em pedaços para o processo principal.
function record(stream: MediaStream): { stop: () => void } {
  // O navegador converte o microfone para 16 kHz.
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor em vez de AudioWorklet: o worklet pediria um arquivo de script à parte.
  const node = ctx.createScriptProcessor(CHUNK, 1, 1)
  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const pcm = new Int16Array(input.length)
    let sum = 0
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      sum += s * s
    }
    ipcRenderer.send('speech:audio', new Uint8Array(pcm.buffer))
    emit({ type: 'level', value: level(sum, input.length) })
  }
  source.connect(node)
  // O processador só roda ligado à saída; como não escreve nada nela, não sai som.
  node.connect(ctx.destination)
  return {
    stop: () => {
      node.onaudioprocess = null
      node.disconnect()
      source.disconnect()
      void ctx.close()
    }
  }
}

export const winMic = {
  // Começa o ditado: avisa o processo principal (que encerra o ditado anterior, como no Mac) e
  // abre o microfone. Sem microfone, o erro aparece e o ditado do processo principal para.
  async start(): Promise<void> {
    winMic.stop()
    const mine = ++seq
    acked = false
    ipcRenderer.send('speech:start')
    const fail = (message: string) => {
      if (mine !== seq) return
      emit({ type: 'error', message, action: 'dictation-settings' })
      ipcRenderer.send('speech:stop')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
    } catch (err) {
      return fail(micError(err))
    }
    const closeStream = () => stream.getTracks().forEach((t) => t.stop())
    if (mine !== seq) return closeStream()
    try {
      const recording = record(stream)
      running = {
        stop: () => {
          recording.stop()
          closeStream()
        }
      }
    } catch (err) {
      closeStream()
      return fail(`Não deu para gravar o microfone (${(err as Error).message}).`)
    }
    emit({ type: 'ready' })
  },

  stop(): void {
    seq++
    running?.stop()
    running = null
  },

  onEvent(cb: Listener): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
}

if (process.platform === 'win32') {
  ipcRenderer.on('speech:started', () => (acked = true))
  // O processo principal encerrou o ditado (fim do texto ou erro): o microfone desliga junto.
  ipcRenderer.on('speech:event', (_e, event: SpeechEvent) => {
    if (acked && (event.type === 'done' || event.type === 'error')) winMic.stop()
  })
  // O ditado começou em outra janela.
  ipcRenderer.on('speech:micStop', () => winMic.stop())
}
