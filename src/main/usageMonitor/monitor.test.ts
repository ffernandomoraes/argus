import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usage } from '../../shared/usage'

// O monitor de uso de uma conta do Claude, com o login (Chaves/arquivo), o endereço de uso e o
// `claude` trocados por falsos. Casos da parada de 2026-10-26 (Windows com WSL): o uso ficou horas
// sem atualizar, sem aviso na tela nem no Sentry.

const fake = vi.hoisted(() => ({
  reads: [] as (() => Promise<unknown>)[],
  fetch: vi.fn(),
  warn: vi.fn(),
  // Com true, o `claude` abre (um falso que nunca responde); senão, falha ao abrir.
  launches: false,
  spawned: 0,
  // Quantos `claude` deste teste fecharam (pelo fim da entrada ou pelo kill). O do teste anterior
  // pode terminar de fechar já no seguinte (o fim da entrada chega depois do afterEach): conta pela vez.
  closed: 0,
  round: 0,
  // O que o `claude` falso responde a cada pedido de controle; sem isso, fica calado.
  answer: null as ((request: any) => object | null) | null
}))

vi.mock('../chats', () => ({
  claudeLaunch: async () =>
    fake.launches ? { ok: true, file: 'claude', args: [], cwd: '/', env: {} } : { ok: false, error: 'sem claude no teste' }
}))
vi.mock('node:child_process', () => ({
  spawn: () => {
    fake.spawned++
    const round = fake.round
    const proc = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null as number | null,
      signalCode: null
    })
    const exit = (code: number) => {
      if (proc.exitCode !== null) return
      proc.exitCode = code
      if (round === fake.round) fake.closed++
      setTimeout(() => {
        proc.emit('exit', code)
        proc.emit('close', code)
      }, 0)
    }
    // Como o `claude -p`: responde cada linha e sai quando a entrada acaba (ver closeGently).
    proc.stdin.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        const reply = fake.answer?.(JSON.parse(line))
        if (reply) proc.stdout.write(JSON.stringify(reply) + '\n')
      }
    })
    proc.stdin.on('finish', () => exit(0))
    return Object.assign(proc, { kill: () => exit(143) })
  }
}))
// Cada leitura do login devolve o guardado e o estado dele, na regra de store.ts (loginState).
vi.mock('../claudeAuth/store', () => ({
  readStoredState: async () => {
    const stored = (await (fake.reads.shift() ?? (() => Promise.resolve(null)))()) as any
    if (!stored) return { stored: null, state: 'missing' }
    const oauth = stored.claudeAiOauth
    const state = !oauth ? 'empty' : oauth.accessToken ? 'ok' : oauth.refreshToken === '' ? 'ended' : 'empty'
    return { stored, state }
  }
}))
vi.mock('../errorReports', () => ({ reportWarning: fake.warn }))

const { UsageMonitor } = await import('./monitor')

const MIN = 60_000
const login = (expiresIn: number) => () =>
  Promise.resolve({ claudeAiOauth: { accessToken: 'token', expiresAt: Date.now() + expiresIn, subscriptionType: 'max' } })
const never = () => () => new Promise<never>(() => {})
// O login como o Claude Code deixa ao apagá-lo, depois de a renovação ser recusada (2.1.319).
const ended = () => () =>
  Promise.resolve({ claudeAiOauth: { accessToken: '', refreshToken: '', expiresAt: 0, loginEnded: 'time_limit' } })
// O `claude` sem limites para dar (sem login): responde ao "init" e ao pedido de uso, este sem os limites.
const noLimitsAnswer = (req: any) => ({
  type: 'control_response',
  response: {
    subtype: 'success',
    request_id: req.request_id,
    response:
      req.request.subtype === 'initialize'
        ? { models: [] }
        : { rate_limits_available: false, rate_limits: null, subscription_type: null }
  }
})
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
  fake.launches = false
  fake.spawned = 0
  fake.closed = 0
  fake.round++
  fake.answer = null
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

    fake.fetch.mockImplementation(async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }))
    await vi.advanceTimersByTimeAsync(15 * MIN)
    const failure = updates.at(-1)?.failure
    expect(failure?.reason).toBe('rate_limited')
    expect(failure?.retryAt).toBe(Date.now() + 120_000)

    const calls = fake.fetch.mock.calls.length
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(MIN)
    expect(fake.fetch.mock.calls.length).toBe(calls)
  })

  it('espera pedida longa tem teto: 5 minutos, depois 10 e 15 seguidas (2026-11-11, 1 hora pedida)', async () => {
    fake.reads.push(login(180 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    const start = Date.now()
    fake.fetch.mockImplementation(async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } }))
    await vi.advanceTimersByTimeAsync(MIN)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(0)
    const retries: number[] = []
    for (let i = 0; i < 4; i++) {
      const calls = fake.fetch.mock.calls.length
      retries.push(updates.at(-1)!.failure!.retryAt! - Date.now())
      while (fake.fetch.mock.calls.length === calls && Date.now() - start < 3 * 60 * MIN) {
        await vi.advanceTimersByTimeAsync(MIN)
        monitor.refresh(true)
        await vi.advanceTimersByTimeAsync(0)
      }
    }
    expect(retries).toEqual([5 * MIN, 10 * MIN, 15 * MIN, 15 * MIN])

    // Dando certo, o teto volta aos 5 minutos.
    fake.fetch.mockImplementationOnce(async () => ok())
    await vi.advanceTimersByTimeAsync(16 * MIN)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(updates.at(-1)!.failure!.retryAt! - Date.now()).toBeLessThanOrEqual(5 * MIN)
  })

  it('números das conversas atualizam a barra durante a espera, mantendo o semanal do modelo', async () => {
    fake.reads.push(login(180 * MIN))
    const withFable = {
      limits: [
        { kind: 'session', percent: 24, resets_at: '2099-01-01T00:00:00Z' },
        { kind: 'weekly_all', percent: 16, resets_at: '2099-01-08T00:00:00Z' },
        { kind: 'weekly_scoped', percent: 5, resets_at: '2099-01-08T00:00:00Z', scope: { model: { display_name: 'Fable' } } }
      ]
    }
    fake.fetch.mockImplementationOnce(async () => new Response(JSON.stringify(withFable), { status: 200 }))
    await startWithRead()
    fake.fetch.mockImplementation(async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } }))
    await vi.advanceTimersByTimeAsync(MIN)
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(updates.at(-1)?.failure?.reason).toBe('rate_limited')

    monitor.fromChat({ session: { percent: 30, resetsAt: '2099-01-01T00:00:00Z' } })
    const last = updates.at(-1)!
    expect(last.failure).toBeUndefined()
    expect(last.session?.percent).toBe(30)
    expect(last.weekly?.percent).toBe(16)
    expect(last.models).toEqual([{ name: 'Fable', window: { percent: 5, resetsAt: '2099-01-08T00:00:00Z' } }])
    expect(last.updatedAt).toBe(Date.now())
  })

  // 2026-11-12 (print de um Windows): a conversa de uma pasta do WSL rodava com o login de outra
  // conta, e o semanal dela (42%) aparecia na conta que a leitura direta dava como 0%.
  it('números de uma conversa de outra conta (a janela recomeça em outra hora) não entram', async () => {
    fake.reads.push(login(180 * MIN))
    const mine = {
      limits: [
        { kind: 'weekly_all', percent: 0, resets_at: '2099-01-08T02:00:00.332746+00:00' },
        { kind: 'weekly_scoped', percent: 0, resets_at: '2099-01-08T02:00:00+00:00', scope: { model: { display_name: 'Fable' } } }
      ]
    }
    fake.fetch.mockImplementationOnce(async () => new Response(JSON.stringify(mine), { status: 200 }))
    await startWithRead()
    const read = updates.length

    monitor.fromChat({ weekly: { percent: 42, resetsAt: '2099-01-07T01:00:00.000Z' } })
    expect(updates).toHaveLength(read)
    expect(monitor.current?.weekly?.percent).toBe(0)

    // Da mesma conta: a mesma hora de recomeçar, com a diferença de menos de 1 s entre as duas fontes.
    monitor.fromChat({ weekly: { percent: 1, resetsAt: '2099-01-08T02:00:00.000Z' } })
    expect(updates.at(-1)).toMatchObject({ weekly: { percent: 1 }, noSession: true })
  })

  it('o que a conversa não traz some depois de uma hora sem leitura direta, em vez de ficar como novo', async () => {
    fake.reads.push(login(180 * MIN))
    const withFable = {
      limits: [
        { kind: 'session', percent: 24, resets_at: '2099-01-01T00:00:00Z' },
        { kind: 'weekly_all', percent: 16, resets_at: '2099-01-08T00:00:00Z' },
        { kind: 'weekly_scoped', percent: 5, resets_at: '2099-01-08T00:00:00Z', scope: { model: { display_name: 'Fable' } } }
      ]
    }
    fake.fetch.mockImplementationOnce(async () => new Response(JSON.stringify(withFable), { status: 200 }))
    await startWithRead()
    fake.fetch.mockImplementation(async () => new Response('', { status: 403 }))

    await vi.advanceTimersByTimeAsync(50 * MIN)
    monitor.fromChat({ session: { percent: 30, resetsAt: '2099-01-01T00:00:00Z' } })
    expect(updates.at(-1)).toMatchObject({ session: { percent: 30 }, weekly: { percent: 16 }, models: [{ name: 'Fable' }] })

    // Passada uma hora da leitura direta, a sessão (que a conversa trouxe há 20 minutos) continua.
    await vi.advanceTimersByTimeAsync(20 * MIN)
    monitor.fromChat({ weekly: { percent: 17, resetsAt: '2099-01-08T00:00:00Z' } })
    expect(updates.at(-1)).toMatchObject({ session: { percent: 30 }, weekly: { percent: 17 }, models: [] })
  })

  it('login trocado com a leitura direta no ar: a resposta da conta anterior não entra', async () => {
    fake.reads.push(login(180 * MIN))
    let answer!: (res: Response) => void
    fake.fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
    await startWithRead()
    expect(updates).toHaveLength(0)

    monitor.reconnect()
    answer(ok())
    await vi.advanceTimersByTimeAsync(0)
    expect(updates).toHaveLength(0)
    expect(monitor.current).toBeNull()
  })

  // Sem foco, a próxima leitura só sairia em 15 minutos, e a conta ficava sem número na barra até lá.
  it('quando a sessão recomeça, lê de novo em seguida, sem esperar o intervalo', async () => {
    fake.reads.push(login(180 * MIN))
    const soon = { limits: [{ kind: 'session', percent: 80, resets_at: new Date(Date.now() + 4 * MIN).toISOString() }] }
    fake.fetch.mockImplementationOnce(async () => new Response(JSON.stringify(soon), { status: 200 }))
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    expect(fake.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4 * MIN)
    expect(fake.fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6_000)
    expect(fake.fetch).toHaveBeenCalledTimes(2)
    expect(updates.at(-1)?.session?.percent).toBe(42)
  })

  // Login trocado por fora (no terminal): quem confere avisa o app, e a leitura com o login em
  // memória (ainda da conta anterior) não acontece.
  it('login que não é mais o conferido pelo app: não lê', async () => {
    let same = false
    monitor = new UsageMonitor('main', (u) => updates.push(u), undefined, { sameLogin: async () => same })
    fake.reads.push(login(180 * MIN))
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    expect(fake.fetch).not.toHaveBeenCalled()

    same = true
    await vi.advanceTimersByTimeAsync(16 * MIN)
    expect(fake.fetch).toHaveBeenCalledTimes(1)
  })

  describe('login de uma distro do WSL', () => {
    let running: boolean
    beforeEach(() => {
      running = true
      fake.launches = true
      monitor = new UsageMonitor('main', (u) => updates.push(u), undefined, { wsl: { place: '\\\\wsl.localhost\\Ubuntu\\home\\ana', running: async () => running } })
    })

    it('lê direto, sem abrir o claude na abertura', async () => {
      fake.reads.push(login(180 * MIN))
      fake.fetch.mockImplementation(async () => ok())
      monitor.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(fake.spawned).toBe(0)
      expect(updates.at(-1)?.session?.percent).toBe(42)
    })

    it('distro desligada: não lê (abrir a pasta dela ligaria a máquina virtual), diz o motivo e não avisa o Sentry', async () => {
      fake.reads.push(login(180 * MIN))
      fake.fetch.mockImplementation(async () => ok())
      monitor.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(fake.fetch).toHaveBeenCalledTimes(1)

      running = false
      await vi.advanceTimersByTimeAsync(40 * MIN)
      expect(fake.fetch).toHaveBeenCalledTimes(1)
      expect(monitor.current?.failure?.reason).toBe('wsl_stopped')
      expect(fake.warn).not.toHaveBeenCalled()

      running = true
      await vi.advanceTimersByTimeAsync(16 * MIN)
      expect(fake.fetch).toHaveBeenCalledTimes(2)
      expect(monitor.current?.failure).toBeUndefined()
    })

    it('sem login para ler lá: falha, sem deixar um claude aberto de reserva', async () => {
      monitor.start()
      await vi.advanceTimersByTimeAsync(20 * MIN)
      expect(fake.spawned).toBe(0)
      expect(fake.fetch).not.toHaveBeenCalled()
    })
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

    // Passado o prazo, outra falha que segue por 15 minutos vira aviso.
    fake.fetch.mockImplementation(async () => new Response('', { status: 500 }))
    await vi.advanceTimersByTimeAsync(10 * MIN)
    expect(fake.warn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20 * MIN)
    expect(fake.warn).toHaveBeenCalledTimes(1)
  })

  it('no fim do prazo da recusa, tenta de novo antes de avisar o Sentry (ARGUS-A, 0.1.97)', async () => {
    // Recusado já na abertura, sem nenhuma leitura boa, com 1 hora de espera.
    fake.reads.push(login(180 * MIN))
    fake.fetch.mockImplementationOnce(async () => new Response('', { status: 429, headers: { 'retry-after': '3600' } }))
    fake.fetch.mockImplementation(async () => ok())
    await startWithRead()
    expect(fake.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(16 * MIN)
    expect(fake.fetch).toHaveBeenCalledTimes(2)
    expect(updates.at(-1)?.failure).toBeUndefined()
    expect(fake.warn).not.toHaveBeenCalled()
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

  it('o claude de reserva calado reabre depois da espera, não do intervalo de 15 minutos', async () => {
    // Sem login para ler aqui (WSL): fica o `claude` de reserva, que nunca responde.
    fake.launches = true
    monitor.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.spawned).toBe(1)
    // O da abertura fecha em 1 minuto; na batida seguinte, sem login, abre o de reserva.
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(fake.spawned).toBe(2)
    // Calado por mais de 1 minuto: fecha na batida e reabre 30 s depois (sem foco, o intervalo é de 15).
    await vi.advanceTimersByTimeAsync(2 * MIN + 31_000)
    expect(fake.spawned).toBe(3)
    expect(monitor.current).toBeNull()
  })

  // Até a 0.1.108, a resposta sem limites contava como silêncio: o de uma vez só esperava 1 minuto e o
  // de reserva era fechado e reaberto em laço, com "timeout" no aviso (ARGUS-A, 2026-11-08).
  it('o claude que responde sem limites não é fechado e reaberto em laço', async () => {
    fake.launches = true
    fake.answer = noLimitsAnswer
    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    // O de uma vez só fecha ao responder, sem esperar 1 minuto.
    expect(fake.spawned).toBe(1)
    expect(fake.closed).toBe(1)

    // Sem login para ler: fica o de reserva, que responde sem limites e segue aberto.
    await vi.advanceTimersByTimeAsync(20 * MIN)
    expect(fake.spawned).toBe(2)
    expect(fake.closed).toBe(1)
    expect(fake.warn).toHaveBeenCalledTimes(1)
    expect(fake.warn.mock.calls[0][1]).toMatchObject({
      reason: 'unavailable',
      claudeNoLimits: true,
      claudeOpen: true,
      loginState: 'missing'
    })
  })

  // O mecanismo do "Claude sai da conta" (2026-11-08): renovação recusada, o Claude Code apaga o login.
  it('login apagado pelo Claude Code: mostra que terminou, sem abrir o claude de reserva', async () => {
    fake.reads.push(login(60 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    // 401; relido, o login é o mesmo, e o `claude` que renova apaga o login e responde sem limites.
    fake.fetch.mockImplementation(async () => new Response('', { status: 401 }))
    fake.reads.push(login(60 * MIN), ended(), ended(), ended(), ended())
    fake.launches = true
    fake.answer = noLimitsAnswer
    await vi.advanceTimersByTimeAsync(17 * MIN)
    expect(updates.at(-1)?.failure?.reason).toBe('signed_out')
    expect(fake.spawned).toBe(1)

    await vi.advanceTimersByTimeAsync(15 * MIN)
    expect(fake.spawned).toBe(1)
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('sem a chamada direta'))
    expect(fake.warn).toHaveBeenCalledTimes(1)
    expect(fake.warn.mock.calls[0][1]).toMatchObject({
      reason: 'signed_out',
      httpStatus: 401,
      tokenRejected: true,
      loginState: 'ended',
      loginEnded: 'time_limit'
    })
  })

  // ARGUS-A, 2026-11: uma conta recebia 403 em toda tentativa; o monitor insistia, ia para o `claude`
  // de reserva e avisava o Sentry em toda abertura.
  it('recusa da conta (403) espera 1 hora, sem claude de reserva e sem aviso ao Sentry', async () => {
    fake.reads.push(login(600 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    fake.fetch.mockImplementation(async () => new Response('', { status: 403 }))
    await vi.advanceTimersByTimeAsync(15 * MIN)
    expect(updates.at(-1)?.failure).toMatchObject({ reason: 'forbidden', retryAt: Date.now() + 60 * MIN })

    const calls = fake.fetch.mock.calls.length
    monitor.refresh(true)
    await vi.advanceTimersByTimeAsync(59 * MIN)
    expect(fake.fetch.mock.calls.length).toBe(calls)

    await vi.advanceTimersByTimeAsync(3 * 60 * MIN)
    expect(fake.fetch.mock.calls.length).toBeLessThanOrEqual(calls + 4)
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('sem a chamada direta'))
    expect(fake.warn).not.toHaveBeenCalled()
  })

  // ARGUS-A, 2026-11-04: uma falha só e a janela escondida logo depois. Sem foco, a nova tentativa sai
  // em 15 minutos, o mesmo prazo do aviso, e o aviso saía antes dela, na mesma batida.
  it('uma falha e a janela sem foco: tenta de novo antes de avisar o Sentry', async () => {
    fake.reads.push(login(600 * MIN))
    fake.fetch.mockImplementationOnce(async () => ok())
    await startWithRead()

    fake.fetch.mockImplementationOnce(async () => {
      throw new TypeError('fetch failed')
    })
    fake.fetch.mockImplementation(async () => ok())
    await vi.advanceTimersByTimeAsync(15 * MIN)
    expect(monitor.current?.failure?.reason).toBe('failed')

    await vi.advanceTimersByTimeAsync(16 * MIN)
    expect(monitor.current?.failure).toBeUndefined()
    expect(fake.warn).not.toHaveBeenCalled()
  })
})
