import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Sentry from '@sentry/electron/main'
import { echoOfMainLag, hiddenWindowBlock, watchMainLag, watchWindowVisibility } from './snapshot'

// Aviso de janela travada que só existe porque o processo principal parou (o vigia da janela roda
// nele). 2026-10-23 (ARGUS-1): o aviso saiu 42 ms depois de "Processo principal parado por 7200 ms",
// com a janela parada à toa, e virou uma issue a mais para o mesmo travamento (ARGUS-6).

const clock = vi.hoisted(() => ({ now: 0 }))
vi.mock('node:perf_hooks', () => ({ performance: { now: () => clock.now } }))
const ipc = vi.hoisted(() => ({ status: (_e: unknown, _message: unknown) => {} }))
vi.mock('electron', () => ({
  app: { once: () => undefined },
  BrowserWindow: {},
  ipcMain: { on: (_channel: string, listener: typeof ipc.status) => (ipc.status = listener) }
}))
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
  watchWindowVisibility((contents) => (contents.id === 2 ? 'mascot' : 'canvas'))
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

// Aviso de janela escondida: 2026-10-27 (ARGUS-1), um por minuto depois de desbloquear a tela, com a
// janela coberta por outra; 2026-10-26 (ARGUS-7), 70 ms depois de a janela reaparecer. Escondida e
// sem responder é travamento de verdade: ela parou escondida e a pessoa voltou a ela.
describe('hiddenWindowBlock', () => {
  // `answers`: a janela responde à pergunta do processo principal (travada, não responde).
  const status = (id: number, status: string, answers = true) =>
    ipc.status(
      {
        sender: {
          id,
          once: () => undefined,
          isDestroyed: () => false,
          executeJavaScript: () => (answers ? Promise.resolve(0) : new Promise(() => {}))
        }
      },
      { status }
    )

  it('janela escondida agora: o aviso é dela e não vai', async () => {
    status(1, 'visible')
    expect(await hiddenWindowBlock(windowBlock)).toBe(false)
    status(1, 'hidden')
    expect(await hiddenWindowBlock(windowBlock)).toBe(true)
    expect(await hiddenWindowBlock(mainError)).toBe(false)
  })

  it('reapareceu há pouco: parte do tempo sem sinal foi escondida', async () => {
    status(1, 'hidden')
    status(1, 'visible')
    clock.now += 70
    expect(await hiddenWindowBlock(windowBlock)).toBe(true)
    clock.now += 5000
    expect(await hiddenWindowBlock(windowBlock)).toBe(false)
  })

  it('outra janela escondida não explica o aviso desta', async () => {
    status(1, 'visible')
    clock.now += 6000
    status(2, 'hidden')
    expect(await hiddenWindowBlock(windowBlock)).toBe(false)
  })

  it('escondida e sem responder: travou de verdade, e o aviso vai', async () => {
    status(1, 'hidden', false)
    const decided = hiddenWindowBlock(windowBlock)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await decided).toBe(false)
  })

  it('duas janelas de mesmo nome: se uma não responde, o aviso vai', async () => {
    status(1, 'hidden')
    status(3, 'visible', false)
    const decided = hiddenWindowBlock(windowBlock)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await decided).toBe(false)
    status(3, 'visible')
    expect(await hiddenWindowBlock(windowBlock)).toBe(true)
  })
})
