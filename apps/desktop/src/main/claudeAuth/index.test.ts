import { beforeEach, describe, expect, it, vi } from 'vitest'

// 2026-11-08: o Argus renovava o login do Claude sozinho (para o ditado), fora da trava do Claude
// Code; o código de renovação vale uma vez só, e o servidor passava a recusar o dos `claude` abertos,
// que apagavam o login. Agora só lê, e vencido pede ao próprio `claude`.

const stored = vi.hoisted(() => ({ value: null as null | { claudeAiOauth?: Record<string, unknown> }, afterRenew: null as null | { claudeAiOauth?: Record<string, unknown> } }))
const renewWithClaude = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../accounts', () => ({ defaultAccount: () => 'main', accountIds: () => ['main'] }))
vi.mock('./store', () => ({ readStored: vi.fn(async () => (renewWithClaude.mock.calls.length && stored.afterRenew ? stored.afterRenew : stored.value)) }))
vi.mock('./renew', () => ({ renewWithClaude }))

import { claudeAccessToken } from './index'

const login = (accessToken: string, inMs: number) => ({ claudeAiOauth: { accessToken, refreshToken: 'r', expiresAt: Date.now() + inMs } })

describe('claudeAccessToken', () => {
  beforeEach(() => {
    renewWithClaude.mockClear()
    stored.afterRenew = null
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('o Argus não renova o login'))))
  })

  it('válido: devolve sem pedir renovação', async () => {
    stored.value = login('a1', 60 * 60_000)
    await expect(claudeAccessToken()).resolves.toBe('a1')
    expect(renewWithClaude).not.toHaveBeenCalled()
  })

  it('vencido: pede ao `claude` e devolve o que ele gravou, sem renovar por conta própria', async () => {
    stored.value = login('a1', -60_000)
    stored.afterRenew = login('a2', 8 * 60 * 60_000)
    await expect(claudeAccessToken()).resolves.toBe('a2')
    expect(renewWithClaude).toHaveBeenCalledWith('main')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('o `claude` não renovou: tenta com o que tem', async () => {
    stored.value = login('a1', -60_000)
    await expect(claudeAccessToken()).resolves.toBe('a1')
  })

  it('sem login: null', async () => {
    stored.value = null
    await expect(claudeAccessToken()).resolves.toBeNull()
  })
})
