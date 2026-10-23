import { describe, expect, it } from 'vitest'
import { pageOf, type Message } from './history'

const list: Message[] = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, role: 'user', text: `${i}` }))
const ids = (page: { messages: Message[] }) => page.messages.map((m) => m.id)

describe('pageOf', () => {
  it('as últimas, contando do fim, e se há mais antes', () => {
    expect(ids(pageOf(list, { count: 3 }))).toEqual(['m7', 'm8', 'm9'])
    expect(pageOf(list, { count: 3 }).more).toBe(true)
    expect(pageOf(list, { count: 50 }).more).toBe(false)
  })

  it('começa na mais antiga que a tela já tem, mesmo pedindo menos', () => {
    expect(ids(pageOf(list, { since: 'm2', count: 1 }))).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'])
  })

  it('pedir mais do que o trecho da tela carrega as anteriores', () => {
    expect(ids(pageOf(list, { since: 'm8', count: 4 }))).toEqual(['m6', 'm7', 'm8', 'm9'])
  })

  it('mensagem da tela que não existe mais: volta a contar do fim', () => {
    expect(ids(pageOf(list, { since: 'sumiu', count: 2 }))).toEqual(['m8', 'm9'])
  })

  it('com antigas já fora da memória, ainda há mais antes', () => {
    expect(pageOf(list, { count: 50 }, 5).more).toBe(true)
  })

  it('pedido de zero ainda mostra a última', () => {
    expect(ids(pageOf(list, { count: 0 }))).toEqual(['m9'])
  })
})
