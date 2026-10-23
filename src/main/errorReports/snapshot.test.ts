import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Sentry from '@sentry/electron/main'
import { echoOfMainLag, watchMainLag } from './snapshot'

// Aviso de janela travada que só existe porque o processo principal parou (o vigia da janela roda
// nele). 2026-10-23 (ARGUS-1): o aviso saiu 42 ms depois de "Processo principal parado por 7200 ms",
// com a janela parada à toa, e virou uma issue a mais para o mesmo travamento (ARGUS-6).

const clock = vi.hoisted(() => ({ now: 0 }))
vi.mock('node:perf_hooks', () => ({ performance: { now: () => clock.now } }))
vi.mock('electron', () => ({ app: { once: () => undefined }, BrowserWindow: {} }))
vi.mock('@sentry/electron/main', () => ({ addBreadcrumb: () => undefined }))

// Um tique do relógio de 1 s do processo principal, com `stall` ms de atraso.
const tick = (stall = 0) => {
  clock.now += 1000 + stall
  vi.advanceTimersByTime(1000)
}

const windowBlock = {
  exception: { values: [{ type: 'ApplicationNotResponding', mechanism: { type: 'ANR', handled: false } }] },
  tags: { 'event.process': 'canvas' }
} as unknown as Sentry.ErrorEvent
const mainError = { exception: { values: [{ type: 'Error', mechanism: { type: 'generic', handled: false } }] } } as unknown as Sentry.ErrorEvent

beforeAll(() => {
  vi.useFakeTimers()
  watchMainLag()
})
afterAll(() => vi.useRealTimers())
// Cada teste começa com o processo principal em dia há alguns segundos.
beforeEach(() => {
  for (let i = 0; i < 5; i++) tick()
})

describe('echoOfMainLag', () => {
  it('aviso logo depois de o processo principal ficar parado 4 s ou mais é eco dele', () => {
    tick(7200)
    clock.now += 42
    expect(echoOfMainLag(windowBlock)).toBe(true)
    expect(echoOfMainLag(mainError)).toBe(false)
  })

  it('parado agora, antes do tique do relógio, também conta', () => {
    clock.now += 6000
    expect(echoOfMainLag(windowBlock)).toBe(true)
  })

  it('parada curta, ou que já passou, não explica o aviso: a janela travou de verdade', () => {
    tick(1500)
    expect(echoOfMainLag(windowBlock)).toBe(false)
    tick(7200)
    for (let i = 0; i < 4; i++) tick()
    expect(echoOfMainLag(windowBlock)).toBe(false)
  })
})
