import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './timeout'

afterEach(() => {
  vi.useRealTimers()
})

describe('withTimeout', () => {
  it('a resposta que chega a tempo vale', async () => {
    expect(await withTimeout(Promise.resolve('lista'), 1000, null)).toBe('lista')
  })

  it('sem resposta no prazo, vale a reserva', async () => {
    vi.useFakeTimers()
    const answer = withTimeout(new Promise<string>(() => {}), 8000, null)
    await vi.advanceTimersByTimeAsync(8000)
    expect(await answer).toBeNull()
  })

  it('o erro que chega a tempo continua sendo erro', async () => {
    await expect(withTimeout(Promise.reject(new Error('EACCES')), 1000, null)).rejects.toThrow('EACCES')
  })
})
