import { spawn } from 'node:child_process'
import { shell } from 'electron'
import { IS_LINUX, IS_WIN } from '../platform'
import type { Speech } from '../speech'
import { on } from './register'

// Ditado. No Mac quem grava é o programa native/speech; no Windows, a própria janela
// (preload/winMic/), que manda o áudio para cá.
export function registerSpeechIpc(speech: Speech): void {
  on('speech:start', (e) => speech.start(e.sender))
  // Só a janela dona do ditado para ele: o pedido de outra janela é ignorado (ver Speech.stop).
  on('speech:stop', (e) => speech.stop(e.sender))
  on('speech:audio', (e, chunk) => speech.audio(e.sender, Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)))
  // Abre Ajustes do Sistema > Teclado, onde fica o Ditado. No Windows, a permissão do microfone. No
  // Linux não há permissão por app: o som do sistema (GNOME), onde se escolhe e liga o microfone.
  on('speech:openSettings', () => {
    if (IS_LINUX) return void spawn('gnome-control-center', ['sound'], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
    void shell.openExternal(IS_WIN ? 'ms-settings:privacy-microphone' : 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension')
  })
}
