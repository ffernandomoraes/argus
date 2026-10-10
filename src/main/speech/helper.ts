import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import type { SpeechEvent } from '../../shared/speech'
import { guardStdin, writeStdin } from '../lib/childProcess'
import type { Mic, MicEvent, Send, Session } from './types'

// O programa do microfone no Mac (native/speech): grava ("capture") para a transcrição do Claude,
// ou faz o ditado inteiro com o reconhecimento de fala do macOS, a reserva. JSON por linha.

type HelperEvent = SpeechEvent | { type: 'audio'; data: string }

// Empacotado, vem fora do app.asar (de dentro dele não dá para executar). null: não compilado.
export function helperPath(): string | null {
  const helper = app.isPackaged
    ? join(process.resourcesPath, 'speech-helper')
    : join(app.getAppPath(), 'native/speech/build/speech-helper')
  return existsSync(helper) ? helper : null
}

export function spawnHelper(helper: string, args: string[], onEvent: (e: MicEvent) => void, onExit: (reason: string) => void): Mic {
  const proc = spawn(helper, args)
  // Mandar "stop" para um processo que já saiu não pode derrubar o app.
  guardStdin(proc)
  // O programa escreve só no stdout; o stderr é esvaziado para nunca encher e travá-lo.
  proc.stderr.resume()
  let ended = false
  const exited = (reason: string) => {
    if (ended) return
    ended = true
    onExit(reason)
  }
  createInterface({ input: proc.stdout }).on('line', (line) => {
    let event: HelperEvent
    try {
      event = JSON.parse(line) as HelperEvent
    } catch {
      // Linha que não é JSON: ignora.
      return
    }
    if (event.type === 'done' || event.type === 'error') ended = true
    onEvent(event.type === 'audio' ? { type: 'audio', chunk: Buffer.from(event.data, 'base64') } : event)
  })
  // Não abriu (sem permissão de executar, apagado no meio): sem ouvir o erro, ele derrubaria o app.
  proc.on('error', (err) => exited(err.message))
  // Encerrado sem avisar (ex.: derrubado pelo macOS por falta de permissão).
  proc.on('exit', (code, signal) => exited(signal ?? `código ${code}`))
  return {
    stop: () => {
      ended = true
      writeStdin(proc, 'stop\n')
    },
    kill: () => {
      ended = true
      proc.kill()
    }
  }
}

// Reconhecimento de fala do macOS: a reserva.
export function appleSession(helper: string, send: Send, warning?: string): Session {
  if (warning) send({ type: 'warning', message: warning })
  const proc = spawnHelper(helper, ['pt-BR'], (e) => e.type !== 'audio' && send(e), (reason) =>
    send({ type: 'error', message: `O ditado foi interrompido (${reason}).` })
  )
  return { stop: proc.stop, abort: proc.kill }
}
