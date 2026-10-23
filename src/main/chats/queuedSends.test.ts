import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueuedSends } from './queuedSends'

// A fila segura a sessão aberta: se ela esvaziar cedo demais, fechar a conversa mata a mensagem
// que você mandou no meio da resposta.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const message = (id: string) => ({ id, text: `msg ${id}`, at: 0 })

describe('QueuedSends', () => {
  it('pedido novo começou: o que esperava foi entregue nele', () => {
    const drained = vi.fn()
    const q = new QueuedSends(drained, 1000)
    q.add(message('a'))
    q.ended()
    q.started()
    expect(q.size).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(drained).not.toHaveBeenCalled()
  })

  it('sem pedido novo depois do prazo, conta como entregue e avisa uma vez', () => {
    const drained = vi.fn()
    const q = new QueuedSends(drained, 1000)
    q.add(message('a'))
    q.ended()
    vi.advanceTimersByTime(999)
    expect(q.has('a')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(q.size).toBe(0)
    expect(drained).toHaveBeenCalledTimes(1)
  })

  it('notícia do Claude durante a espera recomeça a conta', () => {
    const drained = vi.fn()
    const q = new QueuedSends(drained, 1000)
    q.add(message('a'))
    q.ended()
    vi.advanceTimersByTime(800)
    q.touch()
    vi.advanceTimersByTime(800)
    expect(drained).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(drained).toHaveBeenCalledTimes(1)
  })

  it('fim de pedido com a fila vazia não espera nada', () => {
    const drained = vi.fn()
    new QueuedSends(drained, 1000).ended()
    vi.advanceTimersByTime(5000)
    expect(drained).not.toHaveBeenCalled()
  })

  it('lista na ordem em que foram mandadas', () => {
    const q = new QueuedSends(() => undefined)
    q.add(message('a'))
    q.add(message('b'))
    expect(q.list().map((m) => m.id)).toEqual(['a', 'b'])
  })
})
