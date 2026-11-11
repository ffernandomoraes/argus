import { describe, expect, it } from 'vitest'
import { stepInterfaceZoom } from './interfaceZoom'

describe('stepInterfaceZoom', () => {
  it('sobe e desce um degrau', () => {
    expect(stepInterfaceZoom(1, 1)).toBe(1.1)
    expect(stepInterfaceZoom(1.1, -1)).toBe(1)
  })

  it('para nas pontas', () => {
    expect(stepInterfaceZoom(1.5, 1)).toBe(1.5)
    expect(stepInterfaceZoom(0.8, -1)).toBe(0.8)
  })

  it('valor fora da lista parte do degrau mais próximo', () => {
    expect(stepInterfaceZoom(1.12, 1)).toBe(1.25)
  })
})
