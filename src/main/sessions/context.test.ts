import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assistant, text } from '../../../test/transcript'
import { learnContextWindow } from '../contextWindows'
import { projectDir } from '../transcripts/projectDir'
import { percentOf, sessionContext } from './context'

describe('percentOf', () => {
  it('usa a janela de cada modelo: 1 milhão no Opus/Sonnet 5, 200 mil no Haiku e nos anteriores', () => {
    expect(percentOf({ tokens: 100_000, model: 'claude-opus-5-5' })).toBe(10)
    expect(percentOf({ tokens: 100_000, model: 'claude-haiku-5-5' })).toBe(50)
    expect(percentOf({ tokens: 100_000, model: 'claude-sonnet-4-5' })).toBe(50)
    expect(percentOf({ tokens: 100_000, model: 'claude-sonnet-4-5[1m]' })).toBe(10)
  })

  it('a janela aprendida no chat passa a valer', () => {
    learnContextWindow('claude-teste-9', 400_000)
    expect(percentOf({ tokens: 100_000, model: 'claude-teste-9' })).toBe(25)
  })

  it('sem uso é 0, e nunca passa de 100', () => {
    expect(percentOf(undefined)).toBe(0)
    expect(percentOf({ tokens: 5_000_000, model: 'claude-opus-5-5' })).toBe(100)
  })
})

describe('sessionContext', () => {
  it('lê o fim da conversa e dá a porcentagem', async () => {
    const path = join(process.env.HOME ?? '', 'design')
    mkdirSync(projectDir(path), { recursive: true })
    const line = assistant([text('ok')], { usage: { input_tokens: 0, cache_read_input_tokens: 200_000, output_tokens: 1 } })
    writeFileSync(join(projectDir(path), 'abc.jsonl'), JSON.stringify(line) + '\n')
    expect(await sessionContext(path, 'abc')).toBe(20)
  })

  it('id inválido ou conversa que não existe: 0, sem erro', async () => {
    const path = join(process.env.HOME ?? '', 'design')
    expect(await sessionContext(path, '../x')).toBe(0)
    expect(await sessionContext(path, 'nao-existe')).toBe(0)
  })
})
