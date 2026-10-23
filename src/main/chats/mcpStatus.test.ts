import type { Query } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateMcp, mcpServersOf, removeMcp } from './mcpStatus'

// O painel de MCPs da conversa. Sem `claude` de verdade: a Query responde o que o teste manda.

const openExternal = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('electron', () => ({ shell: { openExternal } }))
vi.mock('../terminals/drawerShells', () => ({ ARGUS_MCP: 'argus' }))
vi.mock('../wsl', () => ({ distroFor: () => null }))
vi.mock('./env', () => ({ claudeCodeOptions: vi.fn(), claudeLaunch: vi.fn(async () => ({ ok: false, error: 'sem claude' })) }))

type Raw = { name: string; status: string; tools?: unknown[]; config?: { type: string } }

const queryAnswering = (...answers: Raw[][]) => {
  const mcpServerStatus = vi.fn(async () => answers[Math.min(mcpServerStatus.mock.calls.length - 1, answers.length - 1)])
  return { q: { mcpServerStatus } as unknown as Query, mcpServerStatus }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('mcpServersOf', () => {
  it('em ordem alfabética, sem as ferramentas do próprio Argus', async () => {
    const { q } = queryAnswering([
      { name: 'linear', status: 'connected', tools: [1, 2], config: { type: 'http' } },
      { name: 'argus', status: 'connected' },
      { name: 'figma', status: 'failed', config: { type: 'stdio' } }
    ])
    const servers = await mcpServersOf(q, false)
    expect(servers.map((s) => [s.name, s.tools, s.signOut])).toEqual([
      ['figma', 0, false],
      ['linear', 2, true]
    ])
  })

  it('logo depois de abrir, pergunta de novo até ninguém ficar conectando', async () => {
    const { q, mcpServerStatus } = queryAnswering([{ name: 'a', status: 'pending' }], [{ name: 'a', status: 'connected' }])
    const servers = mcpServersOf(q)
    await vi.advanceTimersByTimeAsync(400)
    expect((await servers)[0].status).toBe('connected')
    expect(mcpServerStatus).toHaveBeenCalledTimes(2)
  })

  it('desiste depois de 10 segundos e devolve como está', async () => {
    const { q } = queryAnswering([{ name: 'a', status: 'pending' }])
    const servers = mcpServersOf(q)
    await vi.advanceTimersByTimeAsync(11_000)
    expect((await servers)[0].status).toBe('pending')
  })
})

describe('authenticateMcp', () => {
  const asking = (answer: unknown) => ({ mcpAuthenticate: vi.fn(async () => answer) }) as unknown as Query

  it('abre no navegador só link da web', async () => {
    openExternal.mockClear()
    await authenticateMcp(asking({ authUrl: 'https://auth.example.test/x', callbackExpected: true }), 'a')
    await authenticateMcp(asking({ authUrl: 'file:///etc/passwd' }), 'a')
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://auth.example.test/x')
  })

  it('conector do claude.ai (sem volta para o app) pede para reconectar à mão', async () => {
    expect(await authenticateMcp(asking({ authUrl: 'https://claude.ai/x', callbackExpected: false }), 'a')).toEqual({ ok: true, manualReconnect: true })
    expect(await authenticateMcp(asking(undefined), 'a')).toEqual({ ok: true, manualReconnect: false })
  })

  it('falha vira mensagem no painel, não exceção', async () => {
    const q = { mcpAuthenticate: vi.fn(async () => Promise.reject(new Error('sem rede'))) } as unknown as Query
    expect(await authenticateMcp(q, 'a')).toEqual({ ok: false, error: 'sem rede' })
  })
})

describe('removeMcp', () => {
  it('servidor do claude.ai ou de escopo desconhecido não é removido daqui', async () => {
    await expect(removeMcp('x', 'claudeai')).rejects.toThrow('claudeai')
  })

  it('o erro do `claude` chega a quem pediu', async () => {
    await expect(removeMcp('x', 'user')).rejects.toThrow('sem claude')
  })
})
