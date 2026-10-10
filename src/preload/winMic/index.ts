import type { SpeechEvent } from '../../shared/speech'
import { listen, send } from '../ipc'
import { micError } from './audio'
import { record } from './record'

// Microfone do ditado no Windows. No Mac quem grava é o programa native/speech; aqui é a própria
// janela, pelo navegador. Entrega o mesmo que ele: o áudio em 16 kHz, mono, 16 bits (para o processo
// principal, que manda ao serviço de voz do Claude), o volume para as ondas e o "ready".

type Listener = (event: SpeechEvent) => void
const listeners = new Set<Listener>()
const emit = (event: SpeechEvent) => listeners.forEach((l) => l(event))

let running: { stop: () => void } | null = null
// Cada start ganha um número: parar enquanto o microfone abre cancela a abertura.
let seq = 0
// O processo principal já recebeu o último start? Antes disso, um fim ou erro que chegue é do
// ditado anterior (que ainda estava fechando) e não pode desligar o microfone deste.
let acked = true

export const winMic = {
  // Começa o ditado: avisa o processo principal (que encerra o ditado anterior, como no Mac) e
  // abre o microfone. Sem microfone, o erro aparece e o ditado do processo principal para.
  async start(): Promise<void> {
    winMic.stop()
    const mine = ++seq
    acked = false
    send('speech:start')
    const fail = (message: string, action?: 'dictation-settings') => {
      if (mine !== seq) return
      emit({ type: 'error', message, action })
      send('speech:stop')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
    } catch (err) {
      return fail(micError(err), 'dictation-settings')
    }
    const closeStream = () => stream.getTracks().forEach((t) => t.stop())
    if (mine !== seq) return closeStream()
    try {
      const recording = record(stream, (pcm, level) => {
        send('speech:audio', new Uint8Array(pcm.buffer))
        emit({ type: 'level', value: level })
      })
      running = {
        stop: () => {
          recording.stop()
          closeStream()
        }
      }
    } catch (err) {
      closeStream()
      return fail(`Não deu para gravar o microfone (${(err as Error).message}).`, 'dictation-settings')
    }
    // Microfone desconectado no meio (USB, Bluetooth): o ditado para com o aviso, em vez de seguir
    // gravando silêncio. Parar o microfone de propósito não dispara isto.
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (mine !== seq) return
        fail('O microfone foi desconectado.')
        winMic.stop()
      }
    })
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
  listen('speech:started', () => (acked = true))
  // O processo principal encerrou o ditado (fim do texto ou erro): o microfone desliga junto.
  listen('speech:event', (event) => {
    if (acked && (event.type === 'done' || event.type === 'error')) winMic.stop()
  })
  // O ditado começou em outra janela.
  listen('speech:micStop', () => winMic.stop())
}
