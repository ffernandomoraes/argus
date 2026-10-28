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

describe('drawerReducer: plano', () => {
  const withRect = () => {
    const state = shown('pasta', 's1')
    return drawerReducer(state, { type: 'rect', slot: 'd1', rect: { x: 8, y: 42, width: 1584, height: 900, area } })
  }

  it('abrir o plano abre espaço no drawer que o pediu', () => {
    const state = drawerReducer(withRect(), { type: 'openPlan', slot: 'd1', text: '# Plano', area })
    expect(state.plan).toEqual({ slot: 'd1', text: '# Plano' })
    expect(state.drawers[0].rect?.x).toBeGreaterThan(8)
  })

  it('abrir um arquivo ou fechar o drawer fecha o plano', () => {
    const open = drawerReducer(withRect(), { type: 'openPlan', slot: 'd1', text: '# Plano', area })
    const file = drawerReducer(open, { type: 'openFile', slot: 'd1', file: { root: '/p', path: 'a.ts' } })
    expect(file.plan).toBeNull()
    expect(drawerReducer(open, { type: 'close', slot: 'd1' }).plan).toBeNull()
  })

  it('com o plano por cima do código, o botão do código mostra o código', () => {
    const code = drawerReducer(withRect(), { type: 'toggleCode', slot: 'd1' })
    const open = drawerReducer(code, { type: 'openPlan', slot: 'd1', text: '# Plano', area })
    const back = drawerReducer(open, { type: 'toggleCode', slot: 'd1' })
    expect(back.plan).toBeNull()
    expect(back.code.open).toBe(true)
  })
})

describe('drawerReducer: plano de uma conversa do canvas', () => {
  it('abre sem drawer e não mexe nos que estão à vista', () => {
    const state = shown('pasta', 's1')
    const open = drawerReducer(state, { type: 'openPlan', slot: null, text: '# Plano', area })
    expect(open.plan).toEqual({ slot: null, text: '# Plano' })
    expect(open.drawers).toBe(state.drawers)
    expect(drawerReducer(open, { type: 'close', slot: 'd1' }).plan).toEqual(open.plan)
  })
})

describe('drawerReducer: subagente', () => {
  const subagent = { sessionId: 's1', toolUseId: 'toolu_1', agent: 'Explore', description: 'procura' }
  const showSubagent = (state: ReturnType<typeof shown>) =>
    drawerReducer(state, { type: 'show', conversation: { nodeId: 'pasta', conversationId: 'subagent-toolu_1', subagent }, area })

  it('abre por cima da conversa, no mesmo drawer, e o voltar traz a conversa de volta', () => {
    const over = showSubagent(shown('pasta', 's1'))
    expect(over.drawers).toHaveLength(1)
    expect(over.drawers[0].conversation.subagent).toEqual(subagent)
    const back = drawerReducer(over, { type: 'replace', slot: 'd1', conversation: { nodeId: 'pasta', conversationId: 's1' } })
    expect(back.drawers).toHaveLength(1)
    expect(back.drawers[0].conversation).toEqual({ nodeId: 'pasta', conversationId: 's1' })
  })

  it('com a conversa fixada, abre num drawer novo ao lado', () => {
    const pinned = drawerReducer(shown('pasta', 's1'), { type: 'togglePin', slot: 'd1' })
    const over = showSubagent(pinned)
    expect(over.drawers.map((d) => d.conversation.conversationId)).toEqual(['s1', 'subagent-toolu_1'])
    // Voltar com a conversa já à vista no fixado: o do subagente só fecha.
    const back = drawerReducer(over, { type: 'replace', slot: 'd2', conversation: { nodeId: 'pasta', conversationId: 's1' } })
    expect(back.drawers.map((d) => d.id)).toEqual(['d1'])
  })
})
