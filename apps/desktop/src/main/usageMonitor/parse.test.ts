import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ tr: (pt: string) => pt }))

const { parseChatWindows, parseControlReply, parseRateLimits } = await import('./parse')

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

describe('parseControlReply', () => {
  const reply = (response: object) =>
    JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: 'usage-1', response } })

  // Conferido na 2.1.319 sem login (2026-11-08): sucesso, mas sem os limites. Antes virava resposta
  // vazia, e o monitor tratava o `claude` como calado (ARGUS-A).
  it('resposta ao pedido de uso sem limites vira noLimits, não resposta vazia', () => {
    expect(parseControlReply(reply({ rate_limits_available: false, rate_limits: null, subscription_type: null }), NOW)).toEqual({
      noLimits: true
    })
  })

  it('resposta ao pedido de uso com limites traz o uso', () => {
    const parsed = parseControlReply(reply({ rate_limits: { limits: [row('session', 12)] }, subscription_type: 'max' }), NOW)
    expect(parsed?.usage?.session?.percent).toBe(12)
    expect(parsed?.noLimits).toBeUndefined()
  })
})

describe('parseChatWindows', () => {
  // O rate_limit_event de uma conversa, como veio na 2.1.322 (conta team, 2026-11-11).
  const info = {
    status: 'allowed',
    resetsAt: 1794416400,
    rateLimitType: 'five_hour',
    unifiedWindows: {
      five_hour: { utilization: 0.3, resetsAt: 1794416400, status: 'allowed' },
      seven_day: { utilization: 0.16, resetsAt: 1794848400, status: 'allowed' }
    }
  }

  it('lê a sessão e o semanal em porcentagem, com a hora de recomeçar', () => {
    expect(parseChatWindows(info)).toEqual({
      session: { percent: 30, resetsAt: new Date(1794416400_000).toISOString() },
      weekly: { percent: 16, resetsAt: new Date(1794848400_000).toISOString() }
    })
  })

  it('só o que veio com porcentagem', () => {
    expect(parseChatWindows({ unifiedWindows: { seven_day: { utilization: 0.5, resetsAt: 1794848400 } } })).toEqual({
      weekly: { percent: 50, resetsAt: new Date(1794848400_000).toISOString() }
    })
  })

  it('sem as janelas (versão antiga do Claude Code), nada', () => {
    expect(parseChatWindows({ status: 'allowed', utilization: 0.3 })).toBeNull()
    expect(parseChatWindows({ unifiedWindows: {} })).toBeNull()
    expect(parseChatWindows(null)).toBeNull()
  })
})
