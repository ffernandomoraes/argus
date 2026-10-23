import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignSummary } from '../../../../shared/design'
import type { SessionSummary } from '../../../../shared/sessions'
import type { ConversationSummary } from '../types'

// A lista de conversas de cada pasta (o card e o painel de todas as conversas). Erro aqui é
// conversa que some, fica com o status velho ou aparece fora de ordem.

type Api = Record<string, unknown>
const globals = globalThis as unknown as { window: { api: Api; addEventListener?: unknown }; document: Record<string, unknown> }

// O que o processo principal responde, por pasta; cada leitura espera `gate` antes de responder.
const disk = new Map<string, SessionSummary[]>()
let gate: Promise<void> = Promise.resolve()
const reads = vi.fn()

let mod: {
  convert: typeof import('./convert')
  state: typeof import('./state')
  reads: typeof import('./reads')
  unread: typeof import('./unread')
}

beforeAll(async () => {
  // unread.ts ouve o foco da janela e pergunta se ela está em foco ao ser carregado.
  globals.window.addEventListener = () => undefined
  globals.document.hasFocus = () => false
  globals.window.api.sessions = {
    list: async (path: string) => {
      reads(path)
      await gate
      return disk.get(path) ?? []
    },
    branch: async () => 'main',
    changes: async () => []
  }
  globals.window.api.design = { list: async () => [] }
  mod = {
    convert: await import('./convert'),
    state: await import('./state'),
    reads: await import('./reads'),
    unread: await import('./unread')
  }
})

beforeEach(() => {
  disk.clear()
  reads.mockClear()
  gate = Promise.resolve()
})

const session = (id: string, repliedAt: string, extra: Partial<SessionSummary> = {}) =>
  ({ id, title: id, updatedAt: repliedAt, repliedAt, contextPercent: 10, ...extra }) as SessionSummary
const design = (id: string, updatedAt: string, extra: Partial<DesignSummary> = {}) => ({ id, name: id, updatedAt, ...extra }) as DesignSummary
// Espera as leituras em andamento (cada uma termina em microtarefas).
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('folderList', () => {
  it('conversas e designs juntos, da resposta mais recente para a mais antiga', () => {
    const list = mod.convert.folderList(
      [session('velha', '2026-10-01T00:00:00Z'), session('nova', '2026-10-20T00:00:00Z', { live: 'running' })],
      [design('tela', '2026-10-10T00:00:00Z', { sessionId: 's-design' })]
    )
    expect(list.map((c) => c.id)).toEqual(['nova', 'design:tela', 'velha'])
    expect(list[0]).toMatchObject({ kind: 'conversa', status: 'running', sessionId: 'nova' })
    expect(list[1]).toMatchObject({ kind: 'design', designId: 'tela', sessionId: 's-design' })
    expect(list[2].status).toBe('idle')
  })
})

describe('merge', () => {
  const conv = (id: string, title = id) => ({ id, title, kind: 'conversa', status: 'idle', updatedAt: '', repliedAt: '', contextPercent: 0 }) as ConversationSummary
  const empty = () => ({ sessions: new Map(), branch: new Map(), changes: new Map() })

  it('leitura igual à guardada devolve o mesmo estado (ninguém redesenha)', () => {
    const s = mod.state.merge(empty(), '/p', { list: [conv('a')], branch: 'main' })
    expect(mod.state.merge(s, '/p', { list: [conv('a')], branch: 'main' })).toBe(s)
    expect(mod.state.merge(s, '/p', {})).toBe(s)
  })

  it('só a conversa que mudou vira objeto novo', () => {
    const s = mod.state.merge(empty(), '/p', { list: [conv('a'), conv('b')] })
    const [a, b] = s.sessions.get('/p')!
    const next = mod.state.merge(s, '/p', { list: [conv('a'), conv('b', 'renomeada')] })
    const [a2, b2] = next.sessions.get('/p')!
    expect(a2).toBe(a)
    expect(b2).not.toBe(b)
    expect(b2.title).toBe('renomeada')
  })

  it('parte não lida fica como estava', () => {
    const s = mod.state.merge(empty(), '/p', { list: [conv('a')], branch: 'main' })
    const next = mod.state.merge(s, '/p', { branch: 'feature' })
    expect(next.sessions).toBe(s.sessions)
    expect(next.branch.get('/p')).toBe('feature')
  })
})

describe('leituras das pastas', () => {
  it('cada aviso relê só o que mudou', () => {
    expect(mod.reads.needFor('git')).toEqual({ list: false, branch: true, changes: true })
    expect(mod.reads.needFor('transcript')).toEqual({ list: true, branch: false, changes: false })
    expect(mod.reads.needFor(undefined)).toEqual(mod.reads.EVERYTHING)
  })

  it('a lista lida entra no estado', async () => {
    mod.state.watching.set('/a', 1)
    disk.set('/a', [session('s1', '2026-10-20T00:00:00Z')])
    mod.reads.request('/a', mod.reads.EVERYTHING)
    await settle()
    expect(mod.state.store.get().sessions.get('/a')?.map((c) => c.id)).toEqual(['s1'])
    expect(mod.state.store.get().branch.get('/a')).toBe('main')
  })

  it('pedidos juntos viram uma leitura; o que chega durante uma leitura roda uma vez depois', async () => {
    mod.state.watching.set('/b', 1)
    let open!: () => void
    gate = new Promise((r) => (open = r))
    mod.reads.request('/b', mod.reads.EVERYTHING)
    mod.reads.request('/b', mod.reads.EVERYTHING)
    await settle()
    expect(reads).toHaveBeenCalledTimes(1)
    // Com a primeira em andamento, os avisos viram uma leitura só no fim, com o que cada um pediu:
    // o da conversa (lista) não se perde atrás do aviso do git (só branch e git status).
    mod.reads.request('/b', mod.reads.needFor('transcript'))
    mod.reads.request('/b', mod.reads.needFor('git'))
    mod.reads.request('/b', mod.reads.needFor('git'))
    open()
    await settle()
    await settle()
    expect(reads).toHaveBeenCalledTimes(2)
  })

  it('pasta que ninguém mostra não é lida', async () => {
    mod.reads.request('/ninguem', mod.reads.EVERYTHING)
    await settle()
    expect(reads).not.toHaveBeenCalled()
  })

  it('pasta esquecida no meio da leitura não volta com o resultado dela', async () => {
    mod.state.watching.set('/c', 1)
    disk.set('/c', [session('s1', '2026-10-20T00:00:00Z')])
    let open!: () => void
    gate = new Promise((r) => (open = r))
    mod.reads.request('/c', mod.reads.EVERYTHING)
    await settle()
    mod.state.watching.delete('/c')
    mod.reads.forgetReads('/c')
    open()
    await settle()
    expect(mod.state.store.get().sessions.has('/c')).toBe(false)
  })
})

describe('respostas não vistas', () => {
  const conv = (id: string, status: ConversationSummary['status']) =>
    ({ id, title: id, kind: 'conversa', status, updatedAt: '', repliedAt: '', contextPercent: 0 }) as ConversationSummary

  it('conversa que estava trabalhando e parou, sem ninguém olhando, fica não lida', () => {
    mod.unread.noteFinished([conv('a', 'running'), conv('b', 'needs-you'), conv('c', 'idle')], [conv('a', 'idle'), conv('b', 'idle'), conv('c', 'idle')])
    const unread = mod.unread.unread.get()
    expect(unread.has('a')).toBe(true)
    expect(unread.has('b')).toBe(true)
    expect(unread.has('c')).toBe(false)
  })

  it('aberta em janela separada conta como vista', () => {
    mod.unread.setPoppedOut(new Set(['d']))
    mod.unread.noteFinished([conv('d', 'running')], [conv('d', 'idle')])
    expect(mod.unread.unread.get().has('d')).toBe(false)
  })
})
