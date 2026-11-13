import { describe, expect, it } from 'vitest'
import { LOGIN_WARN_MS, loginEndingSoon, lostLogin, reloginMethod } from './auth'

const now = Date.UTC(2026, 10, 12, 12)
const HOUR = 60 * 60_000

describe('loginEndingSoon', () => {
  it('perto do prazo final, ou já passado: avisa', () => {
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now + 38 * HOUR }, now)).toBe(true)
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now - HOUR }, now)).toBe(true)
  })

  it('longe do prazo: não avisa', () => {
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now + LOGIN_WARN_MS + HOUR }, now)).toBe(false)
  })

  it('sem prazo conhecido, sem login ou sem status: não avisa', () => {
    expect(loginEndingSoon({ loggedIn: true }, now)).toBe(false)
    expect(loginEndingSoon({ loggedIn: false, loginEndsAt: now + HOUR }, now)).toBe(false)
    expect(loginEndingSoon(null, now)).toBe(false)
  })
})

describe('lostLogin', () => {
  it('conta extra sem login: perdeu (elas só entram na lista já logadas)', () => {
    expect(lostLogin({ id: 'ab12cd34', status: { loggedIn: false } })).toBe(true)
  })

  it('principal sem login: só se o app já a viu logada e ninguém saiu dela pelo app', () => {
    expect(lostLogin({ id: 'main', status: { loggedIn: false }, loginMethod: 'claudeai' })).toBe(true)
    expect(lostLogin({ id: 'main', status: { loggedIn: false } })).toBe(false)
  })

  it('logada ou sem status (não deu para conferir): não', () => {
    expect(lostLogin({ id: 'ab12cd34', status: { loggedIn: true } })).toBe(false)
    expect(lostLogin({ id: 'ab12cd34', status: null })).toBe(false)
  })
})

describe('reloginMethod', () => {
  it('do jeito da última vez; sem saber, pela assinatura do Claude', () => {
    expect(reloginMethod({ loginMethod: 'console' })).toBe('console')
    expect(reloginMethod({})).toBe('claudeai')
  })
})
