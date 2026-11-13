import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import { claudeReady } from '../claudePath'
import { guardStdin } from '../lib/childProcess'

type Listener = Parameters<EventEmitter['on']>[1]

// Processo para o SDK aberto durante a troca de versão do Claude Code no Windows (ver
// claudePath/hold.ts): a entrada e a saída ficam prontas já, e o `claude` de verdade abre quando a
// troca terminar, do mesmo jeito que o SDK abriria.
export function heldProcess(o: SpawnOptions): SpawnedProcess {
  const events = new EventEmitter()
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  let child: ChildProcess | null = null
  let killed = false
  let exitCode: number | null = null

  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (exitCode !== null) return
    exitCode = code ?? 1
    stdout.end()
    events.emit('exit', code, signal)
  }

  void claudeReady().then(() => {
    if (killed || o.signal.aborted) return finish(null, 'SIGTERM')
    let c: ChildProcess
    try {
      c = spawn(o.command, o.args, { cwd: o.cwd, env: o.env, signal: o.signal, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
    } catch (err) {
      events.emit('error', err as Error)
      return finish(1, null)
    }
    child = c
    // O pipe não segura erro do destino: `claude` saindo no meio de uma escrita daria EPIPE solto.
    guardStdin(c)
    stdin.pipe(c.stdin!)
    c.stdout!.pipe(stdout, { end: false })
    c.on('error', (e) => {
      events.emit('error', e)
      finish(1, null)
    })
    c.on('close', (code, signal) => finish(code, signal))
  })

  return {
    stdin,
    stdout,
    get killed() {
      return killed
    },
    get exitCode() {
      return exitCode
    },
    kill(signal: NodeJS.Signals) {
      killed = true
      if (child) return child.kill(signal)
      finish(null, signal)
      return true
    },
    on: (event: string, listener: Listener) => void events.on(event, listener),
    once: (event: string, listener: Listener) => void events.once(event, listener),
    off: (event: string, listener: Listener) => void events.off(event, listener)
  } as SpawnedProcess
}
