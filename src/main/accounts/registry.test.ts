import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registryFile } from './paths'

// Como cada conta entrou da última vez (accounts.json): com o login perdido, o "Entrar" abre o
// navegador direto nesse jeito (ver reloginMethod em shared/auth.ts).

async function fresh(saved?: unknown) {
  vi.resetModules()
  const file = registryFile()
  mkdirSync(dirname(file), { recursive: true })
  if (saved === undefined) writeFileSync(file, '{}')
  else writeFileSync(file, JSON.stringify(saved))
  return import('./registry')
}

const saved = () => JSON.parse(readFileSync(registryFile(), 'utf8')) as { methods?: Record<string, string> }

describe('accounts.json: jeito de entrar de cada conta', () => {
  beforeEach(() => {
    if (existsSync(registryFile())) writeFileSync(registryFile(), '{}')
  })

  it('guarda, troca e esquece (sair pelo app)', async () => {
    const r = await fresh()
    expect(r.loginMethod('main')).toBeUndefined()
    r.rememberLoginMethod('main', 'claudeai')
    expect(r.loginMethod('main')).toBe('claudeai')
    expect(saved().methods).toEqual({ main: 'claudeai' })
    r.rememberLoginMethod('main', 'console')
    expect(r.loginMethod('main')).toBe('console')
    r.forgetLoginMethod('main')
    expect(r.loginMethod('main')).toBeUndefined()
    expect(saved().methods).toEqual({})
  })

  it('conta removida leva o jeito junto', async () => {
    const r = await fresh({ accounts: ['ab12cd34'], names: {}, defaultId: 'main', methods: { ab12cd34: 'console' } })
    expect(r.loginMethod('ab12cd34')).toBe('console')
    r.forgetAccount('ab12cd34')
    expect(r.loginMethod('ab12cd34')).toBeUndefined()
  })

  it('arquivo de uma versão anterior (sem methods) ou com valor estranho: ignora', async () => {
    const r = await fresh({ accounts: [], names: {}, defaultId: 'main', methods: { main: 'senha', ab12cd34: 42 } })
    expect(r.loginMethod('main')).toBeUndefined()
    expect(r.loginMethod('ab12cd34')).toBeUndefined()
    const old = await fresh({ accounts: [], names: {}, defaultId: 'main' })
    expect(old.loginMethod('main')).toBeUndefined()
  })
})
