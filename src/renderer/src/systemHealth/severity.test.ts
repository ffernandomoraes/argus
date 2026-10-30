import { describe, expect, it } from 'vitest'
import type { SystemHealthState } from '../../../shared/systemHealth'
import { isFresh, lowered, NOTHING_SEEN, seenOf, severityOf } from './severity'

// O ícone de memória e disco da barra de cima: quando aparece, em que cor, e quando pulsa.

const GB = 1024 ** 3
const state = (memory: 'ok' | 'low' | 'tight', disk: 'ok' | 'low' | 'full' = 'ok', events: string[] = []): SystemHealthState => ({
  memory: { availableBytes: 4 * GB, totalBytes: 16 * GB, level: memory },
  disk: { freeBytes: 50 * GB, totalBytes: 500 * GB, level: disk },
  events: events.map((id) => ({ id, kind: 'chatClosed', at: 0 })),
  freed: []
})

describe('severityOf', () => {
  it('sem aviso com folga; amarelo chegando no limite; vermelho no limite ou com algo encerrado', () => {
    expect(severityOf(state('ok'))).toBeNull()
    expect(severityOf(state('low'))).toBe('warning')
    expect(severityOf(state('ok', 'low'))).toBe('warning')
    expect(severityOf(state('tight'))).toBe('critical')
    expect(severityOf(state('ok', 'full'))).toBe('critical')
    expect(severityOf(state('ok', 'ok', ['e1']))).toBe('critical')
  })
})

describe('pulsar', () => {
  it('pulsa até abrir; depois, só se piorar ou algo novo parar', () => {
    const low = state('low')
    expect(isFresh(low, NOTHING_SEEN)).toBe(true)
    const seen = seenOf(low)
    expect(isFresh(low, seen)).toBe(false)
    expect(isFresh(state('tight'), seen)).toBe(true)
    expect(isFresh(state('low', 'ok', ['e1']), seen)).toBe(true)
  })

  it('"Entendi" tira o que parou da lista sem voltar a pulsar', () => {
    const seen = seenOf(state('low', 'ok', ['e1']))
    expect(isFresh(state('low'), seen)).toBe(false)
  })

  it('melhorou e piorou de novo: volta a pulsar', () => {
    const seen = seenOf(state('low'))
    const after = lowered(state('ok'), seen)
    expect(isFresh(state('low'), after)).toBe(true)
    expect(lowered(state('low'), seen)).toBe(seen)
  })
})
