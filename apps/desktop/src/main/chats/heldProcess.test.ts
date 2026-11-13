import type { SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { heldProcess } from './heldProcess'

// O `claude` abre só quando a troca de versão termina: o teste decide quando é.
let ready: () => void = () => undefined
vi.mock('../claudePath', () => ({ claudeReady: () => new Promise<void>((r) => (ready = r)) }))

beforeEach(() => {
  ready = () => undefined
})

const options = (script: string, signal = new AbortController().signal): SpawnOptions => ({
  command: process.execPath,
  args: ['-e', script],
  cwd: process.cwd(),
  env: { ...process.env } as Record<string, string>,
  signal
})

const collect = (stream: NodeJS.ReadableStream) => {
  let out = ''
  stream.on('data', (d) => (out += d))
  return () => out
}

describe('heldProcess', () => {
  it('o que o SDK escreve antes da troca terminar chega ao `claude` quando ele abre', async () => {
    const p = heldProcess(options('process.stdin.pipe(process.stdout)'))
    const out = collect(p.stdout)
    p.stdin.write('{"type":"user"}\n')
    ready()
    const exited = new Promise<number | null>((r) => p.once('exit', (code: number | null) => r(code)))
    p.stdin.end()
    expect(await exited).toBe(0)
    expect(out()).toBe('{"type":"user"}\n')
    expect(p.exitCode).toBe(0)
  })

  it('parado antes de abrir: nem chega a abrir o `claude`', async () => {
    const p = heldProcess(options('require("fs").writeFileSync(process.env.HOME + "/abriu", "1")'))
    const exited = new Promise<unknown[]>((r) => p.once('exit', (...args: unknown[]) => r(args)))
    expect(p.kill('SIGTERM')).toBe(true)
    expect(await exited).toEqual([null, 'SIGTERM'])
    expect(p.killed).toBe(true)
    ready()
    await new Promise((r) => setTimeout(r, 100))
    expect(existsSync(`${process.env.HOME}/abriu`)).toBe(false)
  })

  it('conversa fechada (sinal do SDK) durante a espera: termina sem abrir', async () => {
    const abort = new AbortController()
    const p = heldProcess(options('setTimeout(() => {}, 10000)', abort.signal))
    abort.abort()
    const exited = once(p as unknown as NodeJS.EventEmitter, 'exit')
    ready()
    expect(await exited).toEqual([null, 'SIGTERM'])
  })

  it('o `claude` que sai com erro passa o código adiante', async () => {
    const p = heldProcess(options('process.exit(3)'))
    ready()
    const [code] = await once(p as unknown as NodeJS.EventEmitter, 'exit')
    expect(code).toBe(3)
    expect(p.exitCode).toBe(3)
  })

  // d8f0e23: o `claude` saindo no meio de uma escrita dava EPIPE solto (a caixa de erro do app).
  // Sem o ouvinte, o EPIPE é erro não tratado e o Vitest reprova o arquivo.
  it('o `claude` saindo no meio de uma escrita não derruba o app', async () => {
    const p = heldProcess(options('setTimeout(() => process.exit(0), 100)'))
    ready()
    const exited = once(p as unknown as NodeJS.EventEmitter, 'exit')
    let done = false
    void exited.then(() => (done = true))
    const big = Buffer.alloc(256 * 1024, 'x')
    while (!done) {
      p.stdin.write(big)
      await new Promise((r) => setTimeout(r, 5))
    }
    await new Promise((r) => setTimeout(r, 50))
  })
})
