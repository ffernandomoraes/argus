import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import { Inbox } from './inbox'

const message = (text: string) => ({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }) as SDKUserMessage

describe('Inbox', () => {
  it('entrega na ordem, inclusive o que chega enquanto a sessão espera, e termina ao fechar', async () => {
    const inbox = new Inbox()
    inbox.push(message('a'))
    const received: unknown[] = []
    const reading = (async () => {
      for await (const m of inbox) received.push(m.message.content)
    })()
    await new Promise((r) => setTimeout(r, 0))
    inbox.push(message('b'))
    inbox.push(message('c'))
    await new Promise((r) => setTimeout(r, 0))
    inbox.close()
    await reading
    expect(received).toEqual(['a', 'b', 'c'])
  })

  it('o que já estava na fila é entregue antes de fechar', async () => {
    const inbox = new Inbox()
    inbox.push(message('a'))
    inbox.close()
    const received: unknown[] = []
    for await (const m of inbox) received.push(m.message.content)
    expect(received).toEqual(['a'])
  })
})
