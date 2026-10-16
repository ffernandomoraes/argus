// Transcrição de áudio anexado à conversa (Configurações > Experimentos). O modelo não vem com o
// app: é baixado na primeira vez que a pessoa aceita, e fica guardado nos dados do app.

// Situação do modelo neste computador. received/total em bytes.
export type TranscriptionModel =
  | { status: 'missing'; total: number }
  | { status: 'downloading'; received: number; total: number }
  | { status: 'ready' }
  | { status: 'error'; message: string }

// Taxa que o Whisper espera: áudio mono a 16 kHz, em amostras de -1 a 1.
export const TRANSCRIPTION_SAMPLE_RATE = 16_000

const AUDIO_EXTENSIONS = ['ogg', 'opus', 'oga', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'webm', 'weba', 'amr']

// Arquivo de áudio pelo tipo ou, quando o sistema não informa (o .opus do WhatsApp vem sem), pela extensão.
export function isAudioFile(name: string, type: string): boolean {
  if (type.startsWith('audio/')) return true
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return AUDIO_EXTENSIONS.includes(ext)
}
