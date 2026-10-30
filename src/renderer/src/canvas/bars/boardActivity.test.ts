import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardSummary } from '../../../../shared/canvas'
import type { ActiveChat } from '../../../../shared/chat'
import type { Store } from '../../lib/createStore'

// A bolinha de "concluído" no menu de workspaces: a conversa que parou num workspace fora da tela
// marca ele (e só ele, ou outro com a mesma pasta) até a janela abrir o workspace.

const active = vi.hoisted(() => ({ store: null as unknown as Store<ActiveChat[]> }))
vi.mock('../activeChats', async () => {
  const { createStore } = await import('../../lib/createStore')
  active.store = createStore<ActiveChat[]>([])
  return { activeChats: active.store }
})
Object.assign(window.api.boards, { show: () => undefined })

const { boardsStore, switchBoard } = await import('../boards')
const { boardStatus, doneBoards } = await import('./boardActivity')

const board = (id: string, paths: string[], sessions: string[] = []): BoardSummary => ({ id, name: id, paths, sessions })
const chat = (key: string, cwd: string, status: ActiveChat['status'] = 'running', sessionId?: string) =>
  ({ key, cwd, status, sessionId, foregroundAgents: 0, background: 0 }) as ActiveChat

const A = board('main', ['~/a'])
const B = board('b', ['~/b'])
const C = board('c', ['~/c'], ['s-solta'])

beforeEach(() => {
  boardsStore.set((s) => ({ ...s, boards: [A, B, C], current: 'main' }))
  switchBoard('b')
  switchBoard('c')
  switchBoard('main')
  active.store.set([])
})

describe('boardActivity', () => {
  it('conversa que termina em outro workspace marca ele; o da janela e os sem a pasta não', () => {
    active.store.set([chat('k1', '~/b'), chat('k2', '~/a')])
    active.store.set([])
    expect([...doneBoards.get()]).toEqual(['b'])
  })

  it('conversa solta (sem pasta) marca o workspace onde foi posta', () => {
    active.store.set([chat('k1', '~', 'running', 's-solta')])
    active.store.set([])
    expect([...doneBoards.get()]).toEqual(['c'])
  })

  it('abrir o workspace na janela tira a marca', () => {
    active.store.set([chat('k1', '~/b')])
    active.store.set([])
    switchBoard('b')
    expect(doneBoards.get().has('b')).toBe(false)
  })

  it('esperando você vale mais que trabalhando, que vale mais que concluído', () => {
    const done = new Set(['b'])
    expect(boardStatus(B, [], done)).toBe('done')
    expect(boardStatus(B, [chat('k', '~/b')], done)).toBe('running')
    expect(boardStatus(B, [chat('k', '~/b'), chat('j', '~/b', 'needs-you')], done)).toBe('needs-you')
    expect(boardStatus(A, [chat('k', '~/b')], done)).toBeNull()
  })

  it('interrompida (o Argus fechou com ela trabalhando) fica entre trabalhando e concluído', () => {
    const done = new Set(['b'])
    const stopped = [{ sessionId: 's1', cwd: '~/b' }]
    expect(boardStatus(B, [], done, stopped)).toBe('interrupted')
    expect(boardStatus(B, [chat('k', '~/b')], done, stopped)).toBe('running')
    expect(boardStatus(C, [], done, [{ sessionId: 's-solta', cwd: '~' }])).toBe('interrupted')
    expect(boardStatus(A, [], done, stopped)).toBeNull()
  })
})
