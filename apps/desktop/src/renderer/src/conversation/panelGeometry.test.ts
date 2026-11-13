import { describe, expect, it } from 'vitest'
import { PANEL_MIN, PANEL_TOP, PLAN_WIDTH, roomForPlan } from './panelGeometry'

const area = { width: 1600, height: 1000 }
const rect = (x: number, width: number) => ({ x, y: PANEL_TOP, width, height: 800, area })

describe('roomForPlan', () => {
  it('com espaço à esquerda do drawer, ele fica onde está', () => {
    const r = rect(900, 680)
    expect(roomForPlan(r, area)).toBe(r)
  })

  it('drawer na largura toda (100%): a borda esquerda anda até caber o plano, a direita fica', () => {
    const next = roomForPlan(rect(8, 1584), area)
    expect(next.x).toBe(16 + PLAN_WIDTH)
    expect(next.x + next.width).toBe(1592)
  })

  it('drawer estreito colado à esquerda: anda para a direita, no tamanho mínimo', () => {
    const next = roomForPlan(rect(8, 300), area)
    expect(next.x).toBe(16 + PLAN_WIDTH)
    expect(next.width).toBe(PANEL_MIN.width)
  })

  it('janela estreita: o plano fica com o que sobra ao lado do drawer no mínimo', () => {
    const small = { width: 900, height: 800 }
    const next = roomForPlan({ ...rect(8, 884), area: small }, small)
    expect(next.width).toBe(PANEL_MIN.width)
    expect(next.x + next.width).toBe(892)
    // 900 - 3 folgas - o drawer no mínimo: menos que o PLAN_WIDTH, e é o que o plano ganha.
    expect(next.x - 16).toBe(900 - 24 - PANEL_MIN.width)
  })
})
