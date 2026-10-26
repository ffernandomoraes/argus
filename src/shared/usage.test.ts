import { describe, expect, it } from 'vitest'
import { expiredUsage, LIVE_MAX_MS, usableUsage, type Usage } from './usage'

// O que a tela pode mostrar do uso: depois de uma hora sem atualizar, nenhum número (2026-10-26: o uso
// de domingo 16:53 aparecia na segunda como se fosse atual).

const NOW = Date.parse('2026-10-26T12:00:00Z')
const window = { percent: 42, resetsAt: '2026-10-26T15:00:00Z' }
const usage = (updatedAt: number, extra: Partial<Usage> = {}): Usage => ({
  session: window,
  weekly: window,
  models: [{ name: 'Fable', window }],
  updatedAt,
  ...extra
})

describe('usableUsage', () => {
  it('mantém os números até uma hora sem atualizar', () => {
    const u = usableUsage(usage(NOW - LIVE_MAX_MS), NOW)!
    expect(expiredUsage(u, NOW)).toBe(false)
    expect(u.session?.percent).toBe(42)
  })

  it('tira todos os números depois de uma hora sem atualizar, e mantém a conta', () => {
    const u = usableUsage(usage(NOW - LIVE_MAX_MS - 1, { failure: { reason: 'timeout' } }), NOW)!
    expect(expiredUsage(u, NOW)).toBe(true)
    expect(u).toMatchObject({ session: null, weekly: null, models: [], failure: { reason: 'timeout' } })
  })

  it('o guardado da abertura anterior segue a regra própria (até 12 horas)', () => {
    const u = usableUsage(usage(NOW - 2 * LIVE_MAX_MS, { saved: true }), NOW)!
    expect(expiredUsage(u, NOW)).toBe(false)
    expect(u.session?.percent).toBe(42)
  })
})
