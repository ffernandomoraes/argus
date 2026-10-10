import { shell } from 'electron'
import { IS_WIN } from '../platform'
import type { Speech } from '../speech'
import { on } from './register'

// Ditado. No Mac quem grava é o programa native/speech; no Windows, a própria janela
// (preload/winMic/), que manda o áudio para cá.
export function registerSpeechIpc(speech: Speech): void {
  on('speech:start', (e) => speech.start(e.sender))
  // Só a janela dona do ditado para ele: o pedido de outra janela é ignorado (ver Speech.stop).
  on('speech:stop', (e) => speech.stop(e.sender))
  on('speech:audio', (e, chunk) => speech.audio(e.sender, Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)))
  // Abre Ajustes do Sistema > Teclado, onde fica o Ditado. No Windows, a permissão do microfone.
  on('speech:openSettings', () =>
    shell.openExternal(IS_WIN ? 'ms-settings:privacy-microphone' : 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension')
  )
}
