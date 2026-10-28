import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usage } from '../../shared/usage'

// O monitor de uso de uma conta do Claude, com o login (Chaves/arquivo), o endereço de uso e o
// `claude` trocados por falsos. Casos da parada de 2026-10-26 (Windows com WSL): o uso ficou horas
// sem atualizar, sem aviso na tela nem no Sentry.

const fake = vi.hoisted(() => ({
  reads: [] as (() => Promise<unknown>)[],
  fetch: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../chats', () => ({ claudeLaunch: async () => ({ ok: false, error: 'sem claude no teste' }) }))
vi.mock('../claudeAuth/store', () => ({ readStored: () => (fake.reads.shift() ?? (() => Promise.resolve(null)))() }))
vi.mock('../errorReports', () => ({ reportWarning: fake.warn }))

const { UsageMonitor } = await import('./monitor')

const MIN = 60_000
const login = (expiresIn: number) => () =>
  Promise.resolve({ claudeAiOauth: { accessToken: 'token', expiresAt: Date.now() + expiresIn, subscriptionType: 'max' } })
const never = () => () => new Promise<never>(() => {})
const body = { limits: [{ kind: 'session', percent: 42, resets_at: '2099-01-01T00:00:00Z' }] }
const ok = () => new Response(JSON.stringify(body), { status: 200 })

let updates: Usage[]
let monitor: InstanceType<typeof UsageMonitor>

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', fake.fetch)
  fake.reads = []
  fake.fetch.mockReset()
  fake.warn.mockReset()
  updates = []
  monitor = new UsageMonitor('main', (u) => updates.push(u))
})

afterEach(() => {
  monitor.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Abre e faz a primeira leitura direta (o painel aberto).
async function startWithRead(): Promise<void> {
  monitor.start()
  monitor.refresh(true)
  await vi.advanceTimersByTimeAsync(0)
}

describe('UsageMonitor', () => {
  it('leitura do login que não volta vira falha em 10 s, com os últimos números', async () => {
    fake.reads.push(login(3 * MIN), never())
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    expect(updates.at(-1)).toMatchObject({ session: { percent: 42 } })
    expect(updates.at(-1)?.failure).toBeUndefined()

    // Sem foco, a próxima leitura sai em 15 minutos; o login já está perto de vencer e é relido.
    await vi.advanceTimersByTimeAsync(15 * MIN)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(updates.at(-1)).toMatchObject({ session: { percent: 42 }, failure: { reason: 'timeout' } })
    expect(monitor.current?.failure?.reason).toBe('timeout')
  })

  it('parado por 15 minutos avisa o Sentry uma vez só', async () => {
    fake.reads.push(login(3 * MIN), never())
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    await vi.advanceTimersByTimeAsync(15 * MIN + 10_000)
    expect(fake.warn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(fake.warn).toHaveBeenCalledTimes(1)
    expect(fake.warn.mock.calls[0][1]).toMatchObject({ reason: 'timeout', loginReadPending: true })
  })

  it('recusa por excesso (429) mostra quando tenta de novo e não pergunta antes', async () => {
    fake.reads.push(login(60 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    fake.fetch.mockImplementation(async () => new Response('', { status: 429, headers: { 'retry-after': '600' } }))
    await vi.advanceTimersByTimeAsync(15 * MIN)
    const failure = updates.at(-1)?.failure
    expect(failure?.reason).toBe('rate_limited')
    expect(failure?.retryAt).toBe(Date.now() + 600_000)

    const calls = fake.fetch.mock.calls.length
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(5 * MIN)
    expect(fake.fetch.mock.calls.length).toBe(calls)
  })

  it('recusa por excesso com espera longa não avisa o Sentry enquanto espera (ARGUS-A)', async () => {
    fake.reads.push(login(180 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    fake.fetch.mockImplementation(async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } }))
    await vi.advanceTimersByTimeAsync(15 * MIN)
    expect(monitor.current?.failure?.reason).toBe('rate_limited')
    await vi.advanceTimersByTimeAsync(50 * MIN)
    expect(fake.warn).not.toHaveBeenCalled()

    // Passado o prazo, outra falha que segue vira aviso.
    fake.fetch.mockImplementation(async () => new Response('', { status: 500 }))
    await vi.advanceTimersByTimeAsync(20 * MIN)
    expect(fake.warn).toHaveBeenCalledTimes(1)
  })

  it('leitura que volta a dar certo tira o aviso', async () => {
    fake.reads.push(login(60 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()
    fake.fetch.mockImplementationOnce(async () => {
      throw new TypeError('fetch failed')
    })
    await vi.advanceTimersByTimeAsync(15 * MIN)
    expect(updates.at(-1)?.failure?.reason).toBe('failed')

    // Falhando, o painel aberto relê depois de 20 s.
    fake.fetch.mockImplementation(async () => ok())
    await vi.advanceTimersByTimeAsync(20_000)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(updates.at(-1)?.failure).toBeUndefined()
    expect(monitor.current?.failure).toBeUndefined()
  })

  it('painel aberto lê de novo depois de 1 minuto, não antes', async () => {
    fake.reads.push(login(60 * MIN))
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    expect(fake.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.fetch).toHaveBeenCalledTimes(2)
  })
})
