import { describe, expect, it } from 'vitest'
import { compactProgress, workingStatus } from './workingStatus'

const base = { foreground: 0, turnStartedAt: 0 }

describe('workingStatus', () => {
  it('esperando a API: a frase muda aos 5, 15 e 30 s', () => {
    const at = (now: number) => workingStatus({ ...base, now }).label
    expect(at(1_000)).toBe('Trabalhando…')
    expect(at(6_000)).not.toBe('Trabalhando…')
    expect(at(16_000)).toBe('Ainda trabalhando nisso…')
    expect(at(31_000)).toBe('Mais um pouco, obrigado pela paciência…')
  })

  it('a frase dos 5 s fica a mesma enquanto o pedido espera', () => {
    const turn = { ...base, turnStartedAt: 7 }
    expect(workingStatus({ ...turn, now: 6_000 }).label).toBe(workingStatus({ ...turn, now: 14_000 }).label)
  })

  it('pensando conta da volta ao raciocínio, não do começo do pedido', () => {
    const activity = { kind: 'thinking' as const, since: 20_000 }
    expect(workingStatus({ ...base, activity, now: 21_000 }).label).toBe('Pensando…')
    expect(workingStatus({ ...base, activity, now: 36_000 }).label).toBe('Ainda pensando…')
  })

  it('executando uma ação não troca de frase com o tempo', () => {
    const activity = { kind: 'running' as const, tool: 'Comando', since: 0 }
    expect(workingStatus({ ...base, activity, now: 60_000 }).label).toBe('Executando comando…')
  })

  it('nova tentativa: o rótulo fica parado e a contagem vai no detalhe', () => {
    const retry = { cause: 'overloaded' as const, attempt: 2, maxRetries: 10, at: 10_000 }
    const early = workingStatus({ ...base, retry, now: 2_500 })
    const late = workingStatus({ ...base, retry, now: 9_500 })
    expect(early.label).toBe(late.label)
    expect(early.detail).toBe('em 8 s - tentativa 2 de 10')
    expect(workingStatus({ ...base, retry, now: 11_000 }).detail).toBe('tentativa 2 de 10')
  })

  it('compactando vale acima de tudo, com a barra desacelerando até 95%', () => {
    const s = workingStatus({ ...base, compactingSince: 0, retry: { cause: 'other', attempt: 1, maxRetries: 3, at: 0 }, now: 25_000 })
    expect(s.label).toBe('Compactando a conversa…')
    expect(s.progress).toBe(63)
    expect(compactProgress(0)).toBe(0)
    expect(compactProgress(10 * 60_000)).toBe(95)
  })
})
