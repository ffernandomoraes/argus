import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Quando o Argus confere as configurações do Windows numa distro: uma vez por abertura, conversas
// abrindo juntas esperam a mesma conferência, e o que falhou é conferido de novo.

const fake = vi.hoisted(() => ({
  home: '/mnt/c/Users/ana' as string | null,
  app: null as string | null,
  spawned: 0,
  // O que o script responde; nulo: fica calado.
  answer: 'windows' as string | null,
  scripts: [] as string[]
}))

vi.mock('node:child_process', () => ({
  spawn: () => {
    fake.spawned++
    const proc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() })
    let script = ''
    proc.stdin.on('data', (d: Buffer) => (script += d.toString()))
    proc.stdin.on('finish', () => {
      fake.scripts.push(script)
      const answer = fake.answer
      if (answer === null) return
      setTimeout(() => {
        for (const p of ['CLAUDE.md', 'skills', 'agents', 'commands', 'output-styles']) proc.stdout.write(`__ARGUS_CFG__${p}=${p === 'agents' ? 'own' : answer}\n`)
        proc.emit('close', 0)
      }, 10)
    })
    return proc
  }
}))
vi.mock('../lib/childProcess', () => ({ writeStdin: (p: { stdin: PassThrough }, text: string) => p.stdin.end(text) }))
vi.mock('../paths', () => ({ expandHome: (p: string) => p }))
vi.mock('./distros', () => ({ WSL_EXE: 'wsl.exe' }))
vi.mock('./log', () => ({ log: () => {} }))
vi.mock('./index', () => ({
  distroFor: (path?: string) => (path ? (/^\\\\wsl/.test(path) ? 'Ubuntu' : fake.app) : fake.app)
}))
vi.mock('./sharedLogin', () => ({ windowsHome: () => fake.home, windowsHomeReady: async () => {} }))

import { forgetWslConfig, prepareWslConfig, usesWindowsItem } from './windowsConfig'

beforeEach(() => {
  vi.useFakeTimers()
  forgetWslConfig()
  fake.home = '/mnt/c/Users/ana'
  fake.app = null
  fake.spawned = 0
  fake.answer = 'windows'
  fake.scripts = []
})
afterEach(() => vi.useRealTimers())

describe('prepareWslConfig', () => {
  it('confere uma vez por abertura, com a pasta do Windows vista de lá, e conversas juntas esperam a mesma', async () => {
    const both = Promise.all([prepareWslConfig('Ubuntu'), prepareWslConfig('ubuntu')])
    await vi.advanceTimersByTimeAsync(20)
    const [a, b] = await both
    expect(a).toEqual({ 'CLAUDE.md': 'windows', skills: 'windows', agents: 'own', commands: 'windows', 'output-styles': 'windows' })
    expect(b).toBe(a)
    expect(fake.spawned).toBe(1)
    expect(fake.scripts[0]).toContain("W='/mnt/c/Users/ana/.claude'")

    expect(await prepareWslConfig('Ubuntu')).toBe(a)
    expect(fake.spawned).toBe(1)
  })

  it('depois de o Argus criar algo no Windows, a próxima confere de novo', async () => {
    const first = prepareWslConfig('Ubuntu')
    await vi.advanceTimersByTimeAsync(20)
    await first
    forgetWslConfig()
    const second = prepareWslConfig('Ubuntu')
    await vi.advanceTimersByTimeAsync(20)
    await second
    expect(fake.spawned).toBe(2)
  })

  it('sem resposta em 20 s: segue sem os links, e a próxima tenta de novo', async () => {
    fake.answer = null
    const late = prepareWslConfig('Ubuntu')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(await late).toBeNull()
    fake.answer = 'windows'
    const again = prepareWslConfig('Ubuntu')
    await vi.advanceTimersByTimeAsync(20)
    expect(await again).not.toBeNull()
    expect(fake.spawned).toBe(2)
  })

  it('sem a pasta do Windows na distro (ou com o claude do app no WSL): não se aplica e nada roda', async () => {
    fake.home = null
    expect(await prepareWslConfig('Ubuntu')).toBeNull()
    expect(fake.spawned).toBe(0)
  })
})

describe('usesWindowsItem', () => {
  const WSL = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\p'

  it('pasta do WSL: o item é o do Windows, a não ser que o Linux tenha o seu', async () => {
    const instructions = usesWindowsItem(WSL, 'CLAUDE.md')
    await vi.advanceTimersByTimeAsync(20)
    expect(await instructions).toBe(true)
    expect(await usesWindowsItem(WSL, 'agents')).toBe(false)
  })

  it('pasta do Windows, ou o claude do app rodando no WSL: não', async () => {
    expect(await usesWindowsItem('C:\\Users\\ana\\p', 'CLAUDE.md')).toBe(false)
    fake.app = 'Ubuntu'
    expect(await usesWindowsItem(WSL, 'CLAUDE.md')).toBe(false)
    expect(fake.spawned).toBe(0)
  })
})
