import { Transcription } from '../transcription'
import { broadcast } from './events'
import { handle, on } from './register'

// Transcrição de áudio anexado: situação e download do modelo, e o texto de cada áudio.
export function registerTranscriptionIpc(): void {
  const transcription = new Transcription((state) => broadcast('transcription:model', state))
  handle('transcription:model', () => transcription.model())
  handle('transcription:transcribe', (_e, samples) => transcription.transcribe(samples))
  on('transcription:download', () => transcription.startDownload())
  on('transcription:cancel', () => transcription.cancelDownload())
}
