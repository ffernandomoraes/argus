import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import type { SpeechEvent } from '../../shared/speech'
import { lang, tr } from '../i18n'
import { guardStdin, writeStdin } from '../lib/childProcess'
import type { Mic, MicEvent } from './types'

// O programa do microfone no Mac (native/speech): grava para a transcrição do Claude. JSON por linha.

type HelperEvent = SpeechEvent | { type: 'audio'; data: string }

// Os avisos do programa (native/speech/main.swift) vêm em português, sem código no evento: em
// inglês, traduzidos aqui pelo começo do texto. O que não estiver na lista passa como veio.
const HELPER_EN: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Não consegui converter o áudio do microfone \((.*)\)\.$/s, (m) => `Couldn’t convert the microphone audio (${m[1]}).`],
  [/^Sem permissão de microfone\./, () => 'No microphone permission. Allow it in System Settings > Privacy & Security > Microphone.'],
  [/^Não consegui abrir o microfone: (.*)$/s, (m) => `Couldn’t open the microphone: ${m[1]}`]
]

function helperMessage(message: string): string {
  if (lang() !== 'en') return message
  for (const [re, en] of HELPER_EN) {
    const m = re.exec(message)
    if (m) return en(m)
  }
  return message
}

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
    if (event.type === 'error') event = { ...event, message: helperMessage(event.message) }
    onEvent(event.type === 'audio' ? { type: 'audio', chunk: Buffer.from(event.data, 'base64') } : event)
  })
  // Não abriu (sem permissão de executar, apagado no meio): sem ouvir o erro, ele derrubaria o app.
  proc.on('error', (err) => exited(err.message))
  // Encerrado sem avisar (ex.: derrubado pelo macOS por falta de permissão).
  proc.on('exit', (code, signal) => exited(signal ?? tr(`código ${code}`, `code ${code}`)))
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
