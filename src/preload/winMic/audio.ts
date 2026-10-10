// Conversões do áudio do microfone, sem depender do navegador nem do Electron.

// Amostras de -1 a 1 viram PCM de 16 bits (o formato que a transcrição do Claude espera) e o
// volume, de 0 a 1.
export function toPcm16(input: Float32Array): { pcm: Int16Array; level: number } {
  const pcm = new Int16Array(input.length)
  let sum = 0
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    sum += s * s
  }
  return { pcm, level: level(sum, input.length) }
}

// -50 dB (silêncio) a 0 dB (muito alto) vira 0 a 1, como no programa do Mac.
export function level(sumSquares: number, count: number): number {
  const rms = Math.sqrt(sumSquares / count)
  const db = 20 * Math.log10(Math.max(rms, 0.000_001))
  return Math.min(1, Math.max(0, (db + 50) / 50))
}

// Mensagem para o erro do getUserMedia.
export function micError(err: unknown): string {
  const name = (err as DOMException | undefined)?.name
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Nenhum microfone encontrado.'
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'O Windows bloqueou o microfone para o Argus. Libere em Configurações › Privacidade e segurança › Microfone.'
  }
  if (name === 'NotReadableError') return 'O microfone está em uso por outro programa.'
  return `Não deu para abrir o microfone (${(err as Error | undefined)?.message ?? String(err)}).`
}
