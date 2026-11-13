import { describe, expect, it } from 'vitest'
import { user } from '../../../test/transcript'
import { commandEvent, modelName } from './events'

describe('modelName', () => {
  it('escreve o modelo como a pessoa conhece', () => {
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelName('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 (1M)')
  })

  // A data no fim não é versão: "claude-opus-4-20250514" virava "Opus 4.20".
  it('ignora a data no fim do id', () => {
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelName('claude-opus-4-20250514')).toBe('Opus 4')
  })

  it('limpa cor de terminal e markdown que vêm na resposta do /model', () => {
    expect(modelName('\x1b[1m**claude-opus-5-5**\x1b[22m')).toBe('Opus 5.5')
  })

  it('outro nome fica como veio', () => {
    expect(modelName('gpt-5.5')).toBe('gpt-5.5')
  })
})

describe('commandEvent', () => {
  const out = (text: string) => user(`<local-command-stdout>${text}</local-command-stdout>`)

  it('/model e /effort viram divisor', () => {
    expect(commandEvent(out('Set model to claude-opus-5-5 and saved to settings'))).toMatchObject({ kind: 'model', text: 'Modelo: Opus 5.5' })
    expect(commandEvent(out('Set effort level to high'))).toMatchObject({ kind: 'effort', text: 'Esforço: high' })
  })

  it('a resposta de outro comando não', () => {
    expect(commandEvent(out('Renomeado'))).toBeNull()
  })
})
