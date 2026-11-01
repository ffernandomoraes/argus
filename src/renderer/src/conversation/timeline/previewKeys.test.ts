import { describe, expect, it } from 'vitest'
import type { ChatState } from '../../../../shared/chat'
import type { Message } from '../types'
import { createPreviewKeys, savedPreviewId } from './previewKeys'

const live = (partial: string) => ({ partial }) as ChatState
const user = (id: string): Message => ({ id, role: 'user', text: 'oi' })
const answer = (id: string, text: string): Message => ({ id, role: 'assistant', text })

// A resposta que acabou de ser escrita entrava na linha do tempo com a chave da mensagem, outra que a
// da prévia: o item nascia de novo, o texto sumia e voltava com a animação de passo novo, e a
// rolagem pulava (a lista o media como item novo).
describe('createPreviewKeys', () => {
  it('a resposta gravada fica com a chave da prévia que estava na tela', () => {
    const keys = createPreviewKeys()
    const before = [user('u1')]
    keys.update(live('Olá, tudo certo.'), before)
    const preview = keys.current()
    const after = [...before, answer('a1', 'Olá, tudo certo.')]
    keys.update(live('Olá, tudo certo.'), after)
    expect(keys.keyOf('a1')).toBe(preview)
    // A próxima prévia é outro item.
    expect(keys.current()).not.toBe(preview)
    // E a chave fica depois que a prévia sai.
    keys.update(live(''), after)
    expect(keys.keyOf('a1')).toBe(preview)
  })

  it('resposta que já estava na tela antes de bater com a prévia fica com a própria chave', () => {
    const keys = createPreviewKeys()
    const messages = [user('u1'), answer('a1', 'Olá, tudo certo.')]
    // O histórico chegou antes do último pedaço da prévia.
    keys.update(live('Olá, tudo'), messages)
    const preview = keys.current()
    keys.update(live('Olá, tudo certo.'), messages)
    expect(keys.keyOf('a1')).toBe('a1')
    expect(keys.current()).not.toBe(preview)
  })

  it('as outras respostas ficam com a chave da mensagem', () => {
    const keys = createPreviewKeys()
    keys.update(null, [user('u1'), answer('a1', 'Pronto.')])
    expect(keys.keyOf('a1')).toBe('a1')
  })
})

describe('savedPreviewId', () => {
  it('a última resposta gravada com o texto da prévia, sem os espaços das pontas', () => {
    expect(savedPreviewId(live('Pronto.\n\n'), [user('u1'), answer('a1', 'Pronto.')])).toBe('a1')
    expect(savedPreviewId(live('Pront'), [user('u1'), answer('a1', 'Pronto.')])).toBeNull()
    expect(savedPreviewId(live(''), [answer('a1', 'Pronto.')])).toBeNull()
  })
})
