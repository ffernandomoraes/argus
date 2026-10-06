import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app, type WebContents } from 'electron'
import type { SpeechEvent } from '../shared/speech'

// Ditado com o reconhecimento de fala do macOS (native/speech). Um de cada vez:
// começar um novo encerra o anterior.
export class Speech {
  private proc: ChildProcessWithoutNullStreams | null = null

  start(target: WebContents): void {
    this.stop()
    const send = (event: SpeechEvent) => !target.isDestroyed() && target.send('speech:event', event)

    const helper = join(app.getAppPath(), 'native/speech/build/speech-helper')
    if (!existsSync(helper)) {
      send({ type: 'error', message: 'Ditado não instalado. Rode `pnpm install` para compilar.' })
      return
    }

    const proc = spawn(helper, ['pt-BR'])
    this.proc = proc
    let ended = false
    createInterface({ input: proc.stdout }).on('line', (line) => {
      try {
        const event = JSON.parse(line) as SpeechEvent
        if (event.type === 'done' || event.type === 'error') ended = true
        send(event)
      } catch {
        // Linha que não é JSON: ignora.
      }
    })
    proc.on('exit', (code, signal) => {
      if (this.proc === proc) this.proc = null
      // Encerrado sem avisar (ex.: derrubado pelo macOS por falta de permissão).
      if (!ended) send({ type: 'error', message: `O ditado foi interrompido (${signal ?? `código ${code}`}).` })
    })
  }

  stop(): void {
    if (!this.proc) return
    this.proc.stdin.write('stop\n')
    this.proc.stdin.end()
    this.proc = null
  }
}
