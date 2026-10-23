import { describe, expect, it } from 'vitest'
import type { ChatSettings } from '../../shared/chat'
import { flagChanges, mergeSettings, openingFlags, toPermissionMode } from './settings'

const current: ChatSettings = { model: 'opus', effort: 'high', thinking: true, ultracode: true, permissionMode: 'manual' }

describe('toPermissionMode', () => {
  it('"manual" do app é o "default" do Claude Code; vazio fica sem mudar', () => {
    expect(toPermissionMode('manual')).toBe('default')
    expect(toPermissionMode('acceptEdits')).toBe('acceptEdits')
    expect(toPermissionMode('')).toBeUndefined()
  })
})

describe('openingFlags', () => {
  it('raciocínio e ultracode vão explícitos na abertura', () => {
    expect(openingFlags({ ...current, thinking: false, ultracode: false })).toEqual({ alwaysThinkingEnabled: false, ultracode: false })
  })
})

describe('flagChanges', () => {
  it('trocar o esforço manda o ultracode junto, senão o Claude Code o desliga', () => {
    expect(flagChanges({ effort: 'low' }, current)).toEqual({ effortLevel: 'low', ultracode: true })
  })

  it('esforço padrão vira null (tira a escolha)', () => {
    expect(flagChanges({ effort: '' }, current)).toEqual({ effortLevel: null, ultracode: true })
  })

  it('o ultracode escolhido na mesma troca vale', () => {
    expect(flagChanges({ effort: 'low', ultracode: false }, current)).toEqual({ effortLevel: 'low', ultracode: false })
  })

  it('modelo e modo de permissão não viram flag', () => {
    expect(flagChanges({ model: 'sonnet', permissionMode: 'plan' }, current)).toEqual({})
  })
})

describe('mergeSettings', () => {
  it('chave sem valor não apaga a atual', () => {
    expect(mergeSettings(current, { model: 'sonnet', effort: undefined })).toEqual({ ...current, model: 'sonnet' })
  })
})
