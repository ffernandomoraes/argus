import { spawn } from 'node:child_process'
import { shell } from 'electron'
import { IS_LINUX, IS_WIN } from '../platform'
import type { Speech } from '../speech'
import { contentsOf } from './page'
import { on } from './register'

// Ditado. No Mac quem grava é o programa native/speech; no Windows, a própria janela
// (preload/winMic/), que manda o áudio para cá.
export function registerSpeechIpc(speech: Speech): void {
  on('speech:start', (e) => {
    const wc = contentsOf(e.sender)
    if (wc) speech.start(wc)
  })
  // Só a janela dona do ditado para ele: o pedido de outra janela é ignorado (ver Speech.stop).
  on('speech:stop', (e) => {
    const wc = contentsOf(e.sender)
    if (wc) speech.stop(wc)
  })
  on('speech:audio', (e, chunk) => {
    const wc = contentsOf(e.sender)
    if (wc) speech.audio(wc, Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
  })
  // Abre Ajustes do Sistema > Teclado, onde fica o Ditado. No Windows, a permissão do microfone. No
  // Linux não há permissão por app: o som do sistema (GNOME), onde se escolhe e liga o microfone.
  on('speech:openSettings', () => {
    if (IS_LINUX) return void spawn('gnome-control-center', ['sound'], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
    void shell.openExternal(IS_WIN ? 'ms-settings:privacy-microphone' : 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension')
  })
}
