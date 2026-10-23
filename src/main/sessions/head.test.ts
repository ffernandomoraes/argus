import { appendFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assistant, image, text, user, writeTranscript } from '../../../test/transcript'
import { emptyHead, readHead } from './head'

const headOf = async (lines: Parameters<typeof writeTranscript>[0]) => {
  const { file, size } = writeTranscript(lines)
  return readHead(file, size, emptyHead())
}

describe('readHead', () => {
  it('acha o primeiro pedido com texto, pulando comandos e avisos', async () => {
    const head = await headOf([user('<command-name>/model</command-name>'), user('arruma o login'), user('outra coisa')])
    expect(head.firstPrompt).toBe('arruma o login')
    expect(head.hasMessages).toBe(true)
  })

  // Um print colado na primeira mensagem deixava a linha com MB, e ler só os primeiros 64 KB a
  // cortava: a conversa sumia da lista.
  it('acha o pedido depois de uma linha enorme com print', async () => {
    const head = await headOf([user([image('x'.repeat(400 * 1024))]), user('agora com texto')])
    expect(head.firstPrompt).toBe('agora com texto')
    expect(head.hasMessages).toBe(true)
  })

  it('conversa só com print conta como conversa, mesmo sem texto para título', async () => {
    const head = await headOf([user([image()])])
    expect(head.firstPrompt).toBeNull()
    expect(head.hasMessages).toBe(true)
  })

  it('sessão aberta e fechada, sem mensagem, não tem conversa', async () => {
    const head = await headOf([{ type: 'queue-operation', operation: 'enqueue' }, user('meta', { isMeta: true })])
    expect(head.hasMessages).toBe(false)
    expect(head.firstPrompt).toBeNull()
  })

  it('reconhece o protótipo do modo design pelo primeiro pedido', async () => {
    const head = await headOf([user([text('<modo-design>instruções</modo-design>'), text('faz a tela')]), assistant([text('ok')])])
    expect(head.design).toBe(true)
  })

  it('continua de onde parou quando o arquivo cresce, e a linha cortada no fim é lida depois', async () => {
    const { file } = writeTranscript([user('<command-name>/clear</command-name>')])
    const cut = JSON.stringify(user('primeiro pedido'))
    appendFileSync(file, cut.slice(0, 30))
    const first = await readHead(file, statSync(file).size, emptyHead())
    expect(first.firstPrompt).toBeNull()
    expect(first.done).toBe(false)

    appendFileSync(file, cut.slice(30) + '\n')
    const second = await readHead(file, statSync(file).size, first)
    expect(second.firstPrompt).toBe('primeiro pedido')
  })
})
