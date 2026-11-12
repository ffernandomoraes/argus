import { describe, expect, it } from 'vitest'
import { barWindow, expiredUsage, LIVE_MAX_MS, showsUsage, usableUsage, type Usage } from './usage'

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

describe('barWindow', () => {
  it('mostra a sessão; na conta sem sessão, o semanal', () => {
    expect(barWindow(usage(NOW))).toBe(window)
    const weekly = { percent: 34, resetsAt: '2026-10-30T09:00:00Z' }
    expect(barWindow(usage(NOW, { session: null, weekly, noSession: true }))).toBe(weekly)
  })

  it('sessão nula sem a marca (leitura parada, janela recomeçada): nada', () => {
    expect(barWindow(usage(NOW, { session: null }))).toBeNull()
  })
})

// 2026-11-12: a cada sessão de 5 horas que acabava, a conta sumia da barra até a leitura seguinte
// (minutos; até 1 hora com o servidor recusando), sem explicação.
describe('showsUsage', () => {
  const past = { percent: 80, resetsAt: '2026-10-26T11:59:00Z' }

  it('sessão que acabou de recomeçar: a conta fica, sem o número antigo e com a marca', () => {
    const u = usableUsage(usage(NOW - 60_000, { session: past }), NOW)!
    expect(u.session).toBeNull()
    expect(u.restarted).toEqual({ session: true })
    expect(barWindow(u)).toBeNull()
    expect(showsUsage(u)).toBe(true)
  })

  it('janelas valendo: sem marca', () => {
    expect(usableUsage(usage(NOW), NOW)!.restarted).toBeUndefined()
  })

  it('guardado da abertura anterior: só aparece com algum número que ainda vale', () => {
    const withWeekly = usableUsage(usage(NOW - 60_000, { saved: true, session: past }), NOW)!
    expect(showsUsage(withWeekly)).toBe(true)
    const nothing = usableUsage(usage(NOW - 60_000, { saved: true, session: past, weekly: past, models: [] }), NOW)!
    expect(showsUsage(nothing)).toBe(false)
  })

  it('login de uma distro do WSL desligada: a linha fica enquanto os números valem e sai quando vencem', () => {
    const off = { failure: { reason: 'wsl_stopped' as const } }
    expect(showsUsage(usableUsage(usage(NOW - 60_000, off), NOW)!)).toBe(true)
    expect(showsUsage(usableUsage(usage(NOW - LIVE_MAX_MS - 1, off), NOW)!)).toBe(false)
    // Outra falha: a conta fica, com o motivo.
    expect(showsUsage(usableUsage(usage(NOW - LIVE_MAX_MS - 1, { failure: { reason: 'timeout' } }), NOW)!)).toBe(true)
  })
})
