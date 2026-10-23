import { describe, expect, it } from 'vitest'
import { drawerReducer, INITIAL_DRAWERS } from './drawerState'

// O Claude levou a conversa para um worktree: o drawer aberto nela passa a abrir do card do
// worktree, onde ela está agora na lista; antes, ficava em branco como "Nova conversa".

const area = { width: 1600, height: 1000 }
const shown = (nodeId: string, conversationId: string, sessionId?: string) =>
  drawerReducer(INITIAL_DRAWERS, { type: 'show', conversation: { nodeId, conversationId, ...(sessionId && { sessionId }) }, area })

describe('drawerReducer: moved', () => {
  it('a conversa aberta passa a ser do card novo, achada pelo id provisório ou pelo da sessão', () => {
    const byKey = drawerReducer(shown('pasta', 'new-1', 's1'), { type: 'moved', conversationId: 'new-1', sessionId: 's1', nodeId: 'wt' })
    expect(byKey.drawers[0].conversation).toMatchObject({ nodeId: 'wt', conversationId: 'new-1', sessionId: 's1' })
    const bySession = drawerReducer(shown('pasta', 's1'), { type: 'moved', conversationId: 'outra-chave', sessionId: 's1', nodeId: 'wt' })
    expect(bySession.drawers[0].conversation.nodeId).toBe('wt')
  })

  it('outra conversa fica onde estava', () => {
    const state = shown('pasta', 's2')
    expect(drawerReducer(state, { type: 'moved', conversationId: 's1', sessionId: 's1', nodeId: 'wt' })).toBe(state)
  })
})
