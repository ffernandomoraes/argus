import { describe, expect, it } from 'vitest'
import type { ChatState } from '../../shared/chat'
import type { ChatEntry } from '../chats/entries'
import { trayRows } from './menu'

// Linhas do menu do ícone da barra de menus: cada conversa uma vez, com o estado mais útil.

const state = (patch: Partial<ChatState> = {}): ChatState => ({
  status: 'idle',
  partial: '',
  permissions: [],
  revision: 0,
  turnTokens: 0,
  agents: [],
  backgroundTasks: 0,
  ...patch
})

describe('trayRows', () => {
  it('a interrompida aparece uma vez, sem a não vista dela; a que voltou a trabalhar vale o estado novo', () => {
    const entries: ChatEntry[] = [
      { id: 'k1', cwd: '/p', state: state({ sessionId: 'a', status: 'running' }) },
      { id: 'k2', cwd: '/p', state: state({ sessionId: 'b' }) }
    ]
    const interrupted = [
      { sessionId: 'a', cwd: '/p' },
      { sessionId: 'b', cwd: '/p' },
      { sessionId: 'c', cwd: '/q' }
    ]
    const unread = [{ id: 'c', cwd: '/q', title: 'C' }, { id: 'd', cwd: '/q', title: 'D' }]
    expect(trayRows(entries, new Map(), unread, interrupted).map((r) => [r.sessionId, r.kind])).toEqual([
      ['a', 'running'],
      ['b', 'interrupted'],
      ['c', 'interrupted'],
      ['d', 'done']
    ])
  })
})
