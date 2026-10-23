import { describe, expect, it } from 'vitest'
import { aiTitle, assistant, compactBoundary, customTitle, text, toolUse, user, writeTranscript } from '../../../test/transcript'
import { readTail } from './tail'

const tailOf = (lines: Parameters<typeof writeTranscript>[0], wantPrompt = false) => {
  const { file, size } = writeTranscript(lines)
  return readTail(file, size, wantPrompt)
}

const usage = (input: number, cacheRead = 0, cacheCreation = 0) => ({
  input_tokens: input,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheCreation,
  output_tokens: 5
})

describe('readTail: uso de contexto', () => {
  it('soma entrada e cache da última resposta', async () => {
    const tail = await tailOf([
      user('oi'),
      assistant([text('primeira')], { usage: usage(100) }),
      user('de novo'),
      assistant([text('segunda')], { usage: usage(10, 2000, 300), model: 'claude-sonnet-5-5' })
    ])
    expect(tail.usage).toEqual({ tokens: 2310, model: 'claude-sonnet-5-5' })
  })

  // Bug corrigido em 65b1a3a: depois de compactar, a barra de contexto mostrava o tamanho de antes.
  it('depois de compactar, vale o tamanho resumido, com o modelo da resposta de antes', async () => {
    const tail = await tailOf([user('oi'), assistant([text('longa')], { usage: usage(10, 150_000) }), compactBoundary(150_010, 12_000)])
    expect(tail.usage).toEqual({ tokens: 12_000, model: 'claude-opus-5-5' })
  })

  it('resposta depois da compactação volta a valer', async () => {
    const tail = await tailOf([
      assistant([text('antes')], { usage: usage(10, 150_000) }),
      compactBoundary(150_010, 12_000),
      user('segue'),
      assistant([text('depois')], { usage: usage(10, 13_000) })
    ])
    expect(tail.usage?.tokens).toBe(13_010)
  })

  it('ignora o aviso do próprio Claude Code (<synthetic>) e os subagentes', async () => {
    const tail = await tailOf([
      assistant([text('real')], { usage: usage(500) }),
      assistant([text('sub')], { usage: usage(9999) }, { isSidechain: true }),
      assistant([text('No response requested.')], { model: '<synthetic>', usage: usage(0) })
    ])
    expect(tail.usage).toEqual({ tokens: 500, model: 'claude-opus-5-5' })
  })
})

describe('readTail: títulos e hora da resposta', () => {
  it('fica com o último título de cada tipo, sem título vazio', async () => {
    const tail = await tailOf([aiTitle('Primeiro'), customTitle('Meu nome'), aiTitle('Segundo'), customTitle('   ')])
    expect(tail.aiTitle).toBe('Segundo')
    // O último custom-title vazio apaga o nome (título vazio sumia com a conversa da lista).
    expect(tail.customTitle).toBeUndefined()
  })

  it('a hora da resposta é a da última com texto, não a de ferramenta', async () => {
    const reply = assistant([text('pronto')])
    const tool = assistant([toolUse('t1', 'Bash', { command: 'ls' })])
    const tail = await tailOf([user('oi'), reply, tool])
    expect(tail.repliedAt).toBe(reply.timestamp)
  })

  it('linha cortada ou lixo no meio não derruba a leitura', async () => {
    const tail = await tailOf([aiTitle('Ok'), '{"type":"assistant","message":{"usa', 'não é json', assistant([text('fim')], { usage: usage(42) })])
    expect(tail.aiTitle).toBe('Ok')
    expect(tail.usage?.tokens).toBe(42)
  })
})

describe('readTail: primeira mensagem', () => {
  it('pula comandos e avisos internos', async () => {
    const tail = await tailOf([user('<command-name>/clear</command-name>'), user('<local-command-stdout></local-command-stdout>'), user('  arruma o login  ')], true)
    expect(tail.firstPrompt).toBe('arruma o login')
  })

  it('só procura quando pedido', async () => {
    const tail = await tailOf([user('oi')], false)
    expect(tail.firstPrompt).toBeUndefined()
  })
})
