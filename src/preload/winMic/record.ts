import { toPcm16 } from './audio'

const SAMPLE_RATE = 16_000
// 1024 amostras a 16 kHz: um pedaço a cada 64 ms, perto do ritmo do volume no Mac.
const CHUNK = 1024

export type Recording = { stop: () => void }

// Grava o microfone e entrega o áudio em pedaços (16 kHz, mono, 16 bits) com o volume. Lança se
// não der para montar a gravação; nesse caso nada fica aberto.
export function record(stream: MediaStream, onChunk: (pcm: Int16Array, level: number) => void): Recording {
  // O navegador converte o microfone para 16 kHz.
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
  const close = () => ctx.close().catch(() => {})
  try {
    const source = ctx.createMediaStreamSource(stream)
    // ScriptProcessor em vez de AudioWorklet: o worklet pediria um arquivo de script à parte.
    const node = ctx.createScriptProcessor(CHUNK, 1, 1)
    node.onaudioprocess = (e) => {
      const { pcm, level } = toPcm16(e.inputBuffer.getChannelData(0))
      onChunk(pcm, level)
    }
    source.connect(node)
    // O processador só roda ligado à saída; como não escreve nada nela, não sai som.
    node.connect(ctx.destination)
    return {
      stop: () => {
        node.onaudioprocess = null
        node.disconnect()
        source.disconnect()
        void close()
      }
    }
  } catch (err) {
    // Montagem pela metade: o contexto de áudio não pode ficar aberto segurando o dispositivo.
    void close()
    throw err
  }
}
