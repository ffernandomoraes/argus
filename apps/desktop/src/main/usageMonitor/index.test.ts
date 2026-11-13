import { describe, expect, it, vi } from 'vitest'
import type { Usage } from '@argus/shared/usage'

// O uso guardado de cada conta aparece na abertura quando o .claude.json dela tem o mesmo login.
// A leitura do arquivo é assíncrona (com o Claude só no WSL, ele está na máquina virtual, que ainda
// pode estar desligando o app inteiro enquanto liga): a tela já pediu o uso quando a resposta chega,
// então ela recebe o aviso.

const fake = vi.hoisted(() => ({
  emails: new Map<string, (email: string | undefined) => void>(),
  saved: new Map<string, { usage: Usage; email: string }>(),
  trusted: new Set<string>()
}))

vi.mock('../auth/status', () => ({
  configEmail: (key: string) => new Promise((resolve) => fake.emails.set(key, resolve))
}))
vi.mock('./codex', () => ({ CodexUsageMonitors: class { all = () => ({}); stop() {} } }))
vi.mock('./monitor', () => ({ UsageMonitor: class {} }))
vi.mock('./wsl', () => ({ WslUsageMonitors: class { all = () => ({}); stop() {} } }))
vi.mock('./saved', () => ({
  SavedUsages: class {
    keys = () => [...fake.saved.keys()]
    get = (key: string) => (fake.trusted.has(key) ? { ...fake.saved.get(key)!.usage, saved: true } : null)
    trust(key: string, email: string | undefined) {
      const e = fake.saved.get(key)
      if (!e || !email || e.email !== email || fake.trusted.has(key)) return false
      fake.trusted.add(key)
      return true
    }
  }
}))

import { UsageMonitors } from './index'

const usage = { fiveHour: { percent: 40 } } as unknown as Usage

function setup() {
  fake.emails.clear()
  fake.trusted.clear()
  fake.saved = new Map([
    ['principal', { usage, email: 'ana@x.com' }],
    ['codex:1', { usage, email: 'ana@x.com' }]
  ])
  const onUpdate = vi.fn()
  const monitors = new UsageMonitors(onUpdate, vi.fn())
  return { monitors, onUpdate }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('UsageMonitors na abertura', () => {
  it('não espera o .claude.json para terminar de abrir', () => {
    const { onUpdate } = setup()
    // A leitura foi pedida (só a do Claude) e ainda não respondeu; nada apareceu ainda.
    expect([...fake.emails.keys()]).toEqual(['principal'])
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('mesmo login: avisa a tela com o uso guardado quando a leitura chega', async () => {
    const { monitors, onUpdate } = setup()
    fake.emails.get('principal')!('ana@x.com')
    await flush()
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('principal', { ...usage, saved: true })
    expect(monitors.all().principal).toEqual({ ...usage, saved: true })
  })

  it('outro login ou arquivo ilegível: nada aparece', async () => {
    const { onUpdate } = setup()
    fake.emails.get('principal')!('outra@x.com')
    await flush()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('app fechando antes da leitura chegar: não avisa', async () => {
    const { monitors, onUpdate } = setup()
    monitors.stop()
    fake.emails.get('principal')!('ana@x.com')
    await flush()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
