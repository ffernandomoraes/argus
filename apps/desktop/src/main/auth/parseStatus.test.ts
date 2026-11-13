import { describe, expect, it } from 'vitest'
import type { Account } from '@argus/shared/auth'
import { loginState, type Stored } from '../claudeAuth/store'
import { parseAuthStatus, storedHint } from './parseStatus'

const now = 1_794_520_000_000
const status: Account = { loggedIn: true, method: 'claude.ai', provider: 'firstParty', email: 'ana@exemplo.com', subscriptionType: 'team' }
const hint = (stored: Stored | null, account = status) => storedHint(account, stored, loginState(stored), now)
const tokens = (expiresAt: number): Stored => ({ claudeAiOauth: { accessToken: 'a', refreshToken: 'r', expiresAt } })
const wiped: Stored = { claudeAiOauth: { accessToken: '', refreshToken: '', expiresAt: 0 } }

// Medido na 2.1.322 com um login falso numa pasta temporária: com o token vencido, o `auth status`
// renova; recusada a renovação, ele apaga o login e mesmo assim responde loggedIn: true (só a
// chamada seguinte diz false). O arquivo é só a pista para perguntar de novo: quem decide se a conta
// está logada é sempre o Claude Code (o login pode estar em outro lugar, como o cofre do Windows).
describe('storedHint', () => {
  it('login guardado apagado: perguntar de novo ao Claude Code', () => {
    expect(hint(wiped)).toBe('confirm')
    expect(hint({ claudeAiOauth: { accessToken: '', expiresAt: 0, loginEnded: 'time_limit' } })).toBe('confirm')
  })

  // Visto no Argus de verdade (2026-11-12): duas conferências seguidas na abertura. A segunda achou
  // a trava da renovação com a primeira, respondeu "logada" e leu o login ainda vencido; a primeira
  // apagou o login logo depois, e a resposta dela era descartada por ser a mais antiga.
  it('token guardado ainda vencido depois do auth status: a renovação está por acontecer', () => {
    expect(hint(tokens(now - 1))).toBe('renewing')
  })

  it('token válido ou sem prazo: vale o que o auth status disse', () => {
    expect(hint(tokens(now + 60_000))).toBe('final')
    expect(hint(tokens(0))).toBe('final')
  })

  it('arquivo ausente ou ilegível: vale o que o auth status disse', () => {
    expect(storedHint(status, null, 'missing', now)).toBe('final')
    expect(storedHint(status, null, 'unreadable', now)).toBe('final')
  })

  it('chave de API, token do ambiente ou sem login: o login guardado não é o que vale', () => {
    expect(hint(wiped, { loggedIn: true, method: 'api-key' })).toBe('final')
    expect(hint(tokens(now - 1), { loggedIn: true, method: 'oauth_token' })).toBe('final')
    expect(hint(wiped, { loggedIn: false })).toBe('final')
  })
})

describe('parseAuthStatus', () => {
  const name = () => undefined

  // Resposta real da 2.1.322 num plano com prazo de sessão.
  it('traz até quando o login vale', () => {
    const out = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', loginExpiresAt: '2026-11-14T05:03:58.535Z', email: 'ana@exemplo.com', orgName: 'Org', subscriptionType: 'team' })
    expect(parseAuthStatus(out, name)).toMatchObject({ loggedIn: true, method: 'claude.ai', email: 'ana@exemplo.com', loginEndsAt: Date.parse('2026-11-14T05:03:58.535Z') })
  })

  it('login sem prazo (loginExpiresAt nulo) ou sem login: sem a data', () => {
    expect(parseAuthStatus(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', loginExpiresAt: null }), name)).not.toHaveProperty('loginEndsAt')
    expect(parseAuthStatus(JSON.stringify({ loggedIn: false, authMethod: 'none', loginExpiresAt: '2026-11-14T05:03:58.535Z' }), name)).not.toHaveProperty('loginEndsAt')
  })
})
