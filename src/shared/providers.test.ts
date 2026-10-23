import { describe, expect, it } from 'vitest'
import { agentProviderOf, isAgentProvider } from './agents'
import { agentRef, parseAgentRef } from './providers'

// A conta de um grupo diz qual agente roda a conversa: "codex:main" vai para o Codex, e a conta do
// Claude ("main" ou 8 letras/números) nunca pode ser confundida com outro agente.

describe('parseAgentRef', () => {
  it('lê agente e conta', () => {
    expect(parseAgentRef('codex:main')).toEqual({ provider: 'codex', account: 'main' })
    expect(parseAgentRef(agentRef('gemini', 'ab12cd34'))).toEqual({ provider: 'gemini', account: 'ab12cd34' })
    expect(parseAgentRef('cursor:main')).toEqual({ provider: 'cursor', account: 'main' })
  })

  it('conta do Claude, vazia ou estranha não é de outro agente', () => {
    for (const account of [undefined, '', 'main', 'ab12cd34', 'claude:main', 'codex:', 'codex:../x', 'CODEX:main', 'codex:main:extra']) {
      expect(parseAgentRef(account)).toBeNull()
    }
  })
})

describe('agentProviderOf', () => {
  it('sem prefixo é o Claude; com prefixo, o agente dele', () => {
    expect(agentProviderOf(undefined)).toBe('claude')
    expect(agentProviderOf('ab12cd34')).toBe('claude')
    expect(agentProviderOf('gemini:main')).toBe('gemini')
  })

  it('isAgentProvider só aceita os quatro agentes', () => {
    expect(['claude', 'codex', 'gemini', 'cursor'].every(isAgentProvider)).toBe(true)
    expect(isAgentProvider('copilot')).toBe(false)
    expect(isAgentProvider(undefined)).toBe(false)
  })
})
