import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ tr: (pt: string) => pt }))

const { parseRateLimits } = await import('./parse')

// Os limites que o `claude` repassa do servidor. Formato conferido na 2.1.316 (conta team, 2026-11-01).

const NOW = Date.parse('2026-11-01T12:00:00Z')
const row = (kind: string, percent: number, extra: object = {}) => ({
  kind,
  group: kind === 'session' ? 'session' : 'weekly',
  percent,
  severity: 'normal',
  resets_at: '2026-11-02T17:00:00+00:00',
  scope: null,
  ...extra
})
const fable = row('weekly_scoped', 3, { scope: { model: { id: null, display_name: 'Fable' }, surface: null } })

describe('parseRateLimits', () => {
  it('lê a sessão, o semanal e o do Fable da lista', () => {
    const usage = parseRateLimits({ limits: [row('session', 29), row('weekly_all', 55), fable] }, 'team', NOW)!
    expect(usage).toMatchObject({ session: { percent: 29 }, weekly: { percent: 55 }, models: [{ name: 'Fable' }] })
    expect(usage.noSession).toBeUndefined()
  })

  // 2026-10-30: o Ultra verificado não tem mais a sessão de 5 horas. Antes, a conta aparecia travada
  // em "0%, começa a contar na próxima mensagem".
  it('conta sem sessão de 5 horas: só o semanal, marcada como sem sessão', () => {
    const usage = parseRateLimits({ five_hour: null, limits: [row('weekly_all', 34), fable] }, 'max', NOW)!
    expect(usage).toMatchObject({ session: null, weekly: { percent: 34 }, noSession: true })
    expect(usage.models).toHaveLength(1)
  })

  it('sem a lista, cai nos campos antigos: sessão nula é janela que ainda não começou', () => {
    const usage = parseRateLimits({ five_hour: null, seven_day: { utilization: 10, resets_at: null } }, 'pro', NOW)!
    expect(usage.session).toEqual({ percent: 0, resetsAt: null })
    expect(usage.noSession).toBeUndefined()
  })
})
