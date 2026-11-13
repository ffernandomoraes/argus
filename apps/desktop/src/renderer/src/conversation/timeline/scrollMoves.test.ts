import { describe, expect, it } from 'vitest'
import { createScrollMoves } from './scrollMoves'

// Subindo a conversa, a lista virtualizada mede os itens que entram em cima e empurra a rolagem pela
// diferença. Isso contava como rolagem sua para baixo: o prompt preso no topo sumia e voltava,
// piscando, a cada item medido (medido no app: some 23 ms depois da correção e volta 36 ms depois).
describe('createScrollMoves', () => {
  it('subindo, a correção da lista não vira descida', () => {
    const moves = createScrollMoves()
    moves.read(5000)
    // Você sobe 20 px e, no mesmo quadro, a lista empurra 156 px ao medir o item que entrou em cima.
    moves.shift(156)
    expect(moves.read(5000 - 20 + 156)).toEqual({ delta: -20, listOnly: false })
  })

  it('evento só da correção da lista não é rolagem sua', () => {
    const moves = createScrollMoves()
    moves.read(3000)
    moves.shift(266)
    expect(moves.read(3266)).toEqual({ delta: 0, listOnly: true })
  })

  it('a correção é descontada uma vez só', () => {
    const moves = createScrollMoves()
    moves.read(1000)
    moves.shift(100)
    moves.read(1100)
    expect(moves.read(1090)).toEqual({ delta: -10, listOnly: false })
  })
})
