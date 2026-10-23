import type { UUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { filesInBlock } from '../../shared/attachedFiles'
import type { ChatSendRequest } from '../../shared/chat'
import { friendlyError, userMessage } from './messages'

const UUID_A = '11111111-1111-4111-8111-111111111111' as UUID

const request = (patch: Partial<ChatSendRequest>): ChatSendRequest => ({
  key: 'k',
  cwd: '/p',
  settings: { model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'manual' },
  text: '',
  images: [],
  ...patch
})

describe('userMessage', () => {
  it('imagens primeiro, depois o texto, os anexos e por último o aviso que não aparece no chat', () => {
    const m = userMessage(
      request({ text: 'olha isso', images: [{ mediaType: 'image/png', data: 'AAA' }], files: [{ path: '/p/a.pdf', size: 10 }], hint: '<aviso>' }),
      UUID_A
    )
    const content = m.message.content as { type: string; text?: string }[]
    expect(content.map((c) => c.type)).toEqual(['image', 'text', 'text', 'text'])
    expect(content[1].text).toBe('olha isso')
    // e5c0def: os anexos vão num bloco que o histórico reconhece e mostra como cartão.
    expect(filesInBlock(content[2].text!)).toEqual([{ path: '/p/a.pdf', size: 10 }])
    expect(content[3].text).toBe('<aviso>')
    expect(m.uuid).toBe(UUID_A)
    expect(m.parent_tool_use_id).toBeNull()
  })

  it('mensagem só com print não manda texto vazio', () => {
    const content = userMessage(request({ images: [{ mediaType: 'image/jpeg', data: 'B' }] }), UUID_A).message.content as { type: string }[]
    expect(content.map((c) => c.type)).toEqual(['image'])
  })
})

describe('friendlyError', () => {
  it('sem o Claude Code instalado, explica o que fazer', () => {
    expect(friendlyError('Claude Code native binary not found at /x')).toContain('não está instalado')
  })

  it('os outros erros passam como vieram', () => {
    expect(friendlyError('rate limited')).toBe('rate limited')
  })
})
