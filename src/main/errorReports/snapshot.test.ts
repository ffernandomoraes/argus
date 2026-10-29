import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Sentry from '@sentry/electron/main'
import {
  echoOfMainLag,
  hiddenWindowBlock,
  powerBreadcrumb,
  unfocusedWindowBlock,
  watchMainLag,
  watchWindowFocus,
  watchWindowVisibility
} from './snapshot'

// Aviso de janela travada que só existe porque o processo principal parou (o vigia da janela roda
// nele). 2026-10-23 (ARGUS-1): o aviso saiu 42 ms depois de "Processo principal parado por 7200 ms",
// com a janela parada à toa, e virou uma issue a mais para o mesmo travamento (ARGUS-6).

const clock = vi.hoisted(() => ({ now: 0 }))
vi.mock('node:perf_hooks', () => ({ performance: { now: () => clock.now } }))
const ipc = vi.hoisted(() => ({ status: (_e: unknown, _message: unknown) => {} }))
const electron = vi.hoisted(() => ({ focused: null as object | null, app: {} as Record<string, () => void> }))
vi.mock('electron', () => ({
  app: { once: () => undefined, on: (event: string, listener: () => void) => (electron.app[event] = listener) },
  BrowserWindow: { getFocusedWindow: () => electron.focused },
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
  watchWindowFocus()
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

// Aviso sem nenhuma janela do Argus em foco: 2026-10-29, ARGUS-1 (o notebook acordou às 3h com a tela
// bloqueada) e ARGUS-5 (tela desbloqueada com a janela minimizada); 2026-10-28, ARGUS-1 a cada minuto
// por 3 horas. O SDK religa o vigia ao acordar e ao desbloquear, sem olhar o foco. E com o foco ganho
// no meio do silêncio: 2026-10-27 (ARGUS-1), 22 ms depois de a janela ganhar o foco.
describe('unfocusedWindowBlock', () => {
  it('sem janela do Argus em foco, o aviso de janela travada não vai', () => {
    electron.focused = null
    expect(unfocusedWindowBlock(windowBlock)).toBe(true)
    expect(unfocusedWindowBlock(mainError)).toBe(false)
  })

  it('foco ganho há menos de 5 s: o silêncio começou sem foco, e o aviso não vai', () => {
    electron.focused = {}
    electron.app['browser-window-focus']()
    clock.now += 22
    expect(unfocusedWindowBlock(windowBlock)).toBe(true)
    // Em foco desde antes de a janela parar: travamento de verdade, e o aviso vai.
    clock.now += 5000
    expect(unfocusedWindowBlock(windowBlock)).toBe(false)
  })
})

describe('powerBreadcrumb', () => {
  it('mudança de limite da CPU entra uma vez por minuto; os outros eventos sempre', () => {
    clock.now += 120_000
    expect(powerBreadcrumb('speed-limit-change')).toBe(true)
    clock.now += 5_000
    expect(powerBreadcrumb('speed-limit-change')).toBe(false)
    expect(powerBreadcrumb('thermal-state-change')).toBe(true)
    expect(powerBreadcrumb('resume')).toBe(true)
    expect(powerBreadcrumb('resume')).toBe(true)
    clock.now += 60_000
    expect(powerBreadcrumb('speed-limit-change')).toBe(true)
  })
})
