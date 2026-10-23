import { describe, expect, it } from 'vitest'
import { emptyHead, type Head } from './head'
import { summarize } from './summary'

const MTIME = new Date('2026-10-20T12:00:00.000Z')
const head = (extra: Partial<Head> = {}): Head => ({ ...emptyHead(), done: true, ...extra })

describe('summarize: título', () => {
  it('prefere o renomeado, depois o gerado pelo Claude, depois a primeira mensagem', () => {
    const h = head({ firstPrompt: 'pedido', hasMessages: true })
    expect(summarize('a', MTIME, h, { customTitle: 'Meu nome', aiTitle: 'Gerado' })?.title).toBe('Meu nome')
    expect(summarize('a', MTIME, h, { aiTitle: 'Gerado' })?.title).toBe('Gerado')
    expect(summarize('a', MTIME, h, {})?.title).toBe('pedido')
    // Começo do arquivo sem pedido: o achado no fim.
    expect(summarize('a', MTIME, head({ hasMessages: true }), { firstPrompt: 'do fim' })?.title).toBe('do fim')
  })

  it('só a primeira linha, até 120 caracteres', () => {
    const long = 'x'.repeat(200)
    expect(summarize('a', MTIME, head({ firstPrompt: 'linha um\nlinha dois' }), {})?.title).toBe('linha um')
    expect(summarize('a', MTIME, head({ firstPrompt: long }), {})?.title).toHaveLength(120)
  })

  it('conversa só com print aparece, com título vazio', () => {
    expect(summarize('a', MTIME, head({ hasMessages: true }), {})?.title).toBe('')
  })

  it('sessão sem nenhuma mensagem não entra na lista', () => {
    expect(summarize('a', MTIME, head(), {})).toBeNull()
  })
})

describe('summarize: horários', () => {
  it('ordena pela última resposta; sem ela, pela gravação do arquivo', () => {
    const h = head({ firstPrompt: 'oi' })
    expect(summarize('a', MTIME, h, { repliedAt: '2026-10-19T10:00:00.000Z' })).toMatchObject({
      updatedAt: MTIME.toISOString(),
      repliedAt: '2026-10-19T10:00:00.000Z'
    })
    expect(summarize('a', MTIME, h, {})?.repliedAt).toBe(MTIME.toISOString())
  })
})
