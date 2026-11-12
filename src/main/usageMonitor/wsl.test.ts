import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, ClaudeAccount } from '../../shared/auth'
import type { Usage } from '../../shared/usage'

// Um monitor de uso por login do WSL que é de outra conta do Claude (2026-11-12: a conta aparecia em
// 0% enquanto as conversas dela no WSL gastavam o limite de outro login).

const fake = vi.hoisted(() => {
  type Options = { wsl?: { place: string; running: () => Promise<boolean> }; sameLogin?: () => Promise<boolean> }
  class FakeMonitor {
    started = 0
    reconnected = 0
    stopped = false
    current = null
    constructor(
      readonly account: string,
      readonly onUpdate: (usage: unknown) => void,
      _onInfo: unknown,
      readonly options: Options
    ) {
      monitors.push(this)
    }
    start() {
      this.started++
    }
    reconnect() {
      this.reconnected++
    }
    stop() {
      this.stopped = true
    }
    refresh() {}
  }
  const monitors: FakeMonitor[] = []
  return { FakeMonitor, monitors, running: ['Ubuntu'] }
})

vi.mock('./monitor', () => ({ UsageMonitor: fake.FakeMonitor }))
vi.mock('../wsl', () => ({
  homeUnc: (d: string) => `\\\\wsl.localhost\\${d}\\home\\ana`,
  toUnc: (d: string, linux: string) => `\\\\wsl.localhost\\${d}${linux}`,
  runningDistros: async () => fake.running,
  sameDistro: (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
}))

import { WslUsageMonitors } from './wsl'

const signedIn = (email: string): Account => ({ loggedIn: true, email })
const account = (status: Account | null, wsl: Account | null): Pick<ClaudeAccount, 'id' | 'status' | 'wsl'> => ({
  id: 'main',
  status,
  wsl: [{ distro: 'Ubuntu', status: wsl }]
})
const KEY = 'wsl:ubuntu:main'

let onUpdate: ReturnType<typeof vi.fn<(key: string, usage: Usage | null) => void>>
let logins: { same: ReturnType<typeof vi.fn>; forget: ReturnType<typeof vi.fn> }
let monitors: WslUsageMonitors

beforeEach(() => {
  fake.monitors.length = 0
  fake.running = ['Ubuntu']
  onUpdate = vi.fn<(key: string, usage: Usage | null) => void>()
  logins = { same: vi.fn(async () => true), forget: vi.fn() }
  monitors = new WslUsageMonitors(onUpdate, logins as never)
})

describe('WslUsageMonitors', () => {
  it('login de lá de outra conta do Claude: abre um monitor que lê o login da distro', async () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    expect(fake.monitors).toHaveLength(1)
    const m = fake.monitors[0]
    expect(m.started).toBe(1)
    expect(m.options.wsl?.place).toBe('\\\\wsl.localhost\\Ubuntu\\home\\ana')
    expect(await m.options.wsl?.running()).toBe(true)
    fake.running = []
    expect(await m.options.wsl?.running()).toBe(false)

    m.onUpdate({ updatedAt: 1 })
    expect(onUpdate).toHaveBeenCalledWith(KEY, { updatedAt: 1 })
  })

  it('login de lá igual ao do Windows: nenhum monitor', () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('ana@x.com'))])
    expect(fake.monitors).toHaveLength(0)
  })

  it('conferência seguinte igual: o mesmo monitor; ainda sem decidir: fica como estava', () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    monitors.sync([account(null, signedIn('bia@x.com'))])
    expect(fake.monitors).toHaveLength(1)
    expect(fake.monitors[0].stopped).toBe(false)
    expect(fake.monitors[0].reconnected).toBe(0)
  })

  it('outro login lá: reabre e tira da tela o uso do anterior', () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    monitors.sync([account(signedIn('ana@x.com'), signedIn('cris@x.com'))])
    expect(fake.monitors).toHaveLength(1)
    expect(fake.monitors[0].reconnected).toBe(1)
    expect(onUpdate).toHaveBeenLastCalledWith(KEY, null)
    expect(logins.forget).toHaveBeenCalledWith(KEY)
  })

  it('saiu de lá, ou passou a ser o mesmo login do Windows: fecha e some da tela', () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    monitors.sync([account(signedIn('ana@x.com'), { loggedIn: false })])
    expect(fake.monitors[0].stopped).toBe(true)
    expect(onUpdate).toHaveBeenLastCalledWith(KEY, null)
    expect(monitors.all()).toEqual({})
  })

  it('entrou de novo pelo app naquela distro: reabre', () => {
    monitors.sync([account(signedIn('ana@x.com'), signedIn('bia@x.com'))])
    monitors.reconnect('ubuntu', 'main')
    expect(fake.monitors[0].reconnected).toBe(1)
  })
})
