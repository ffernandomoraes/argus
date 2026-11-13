import { describe, expect, it } from 'vitest'
import { addUsage, emptyDay, localDay, toolName, usageDelta } from './day'

const u = (input: number, output: number, costUsd = 0) => ({ input, output, cacheRead: 0, cacheWrite: 0, costUsd })

describe('usageDelta', () => {
  it('conta tudo na primeira leitura da conversa', () => {
    expect(usageDelta(undefined, { opus: u(100, 50, 1) })).toEqual({ opus: u(100, 50, 1) })
  })

  // O Claude Code manda o total da sessão a cada pedido: somar os totais contaria o primeiro pedido
  // de novo a cada mensagem.
  it('conta só o que entrou desde a leitura anterior', () => {
    expect(usageDelta({ opus: u(100, 50, 1) }, { opus: u(150, 80, 1.5) })).toEqual({ opus: u(50, 30, 0.5) })
  })

  it('recomeça quando o total cai (/clear zera a conta)', () => {
    expect(usageDelta({ opus: u(1000, 500) }, { opus: u(20, 10) })).toEqual({ opus: u(20, 10) })
  })

  it('deixa de fora o modelo que não gastou nada no pedido', () => {
    expect(usageDelta({ opus: u(100, 50), haiku: u(10, 5) }, { opus: u(120, 60), haiku: u(10, 5) })).toEqual({ opus: u(20, 10) })
  })
})

describe('toolName', () => {
  it('esconde o nome dos servidores MCP', () => {
    expect(toolName('mcp__empresa-secreta__deploy')).toBe('mcp')
  })

  it('mantém as ferramentas do Claude Code', () => {
    expect(toolName('Bash')).toBe('Bash')
  })

  it('troca nomes estranhos por "other"', () => {
    expect(toolName('../../etc/passwd')).toBe('other')
  })
})

describe('addUsage', () => {
  it('soma pedidos e tokens no modelo', () => {
    const day = emptyDay()
    addUsage(day, 'claude:opus', u(10, 5, 0.1))
    addUsage(day, 'claude:opus', u(1, 1, 0.1), 0)
    expect(day.models['claude:opus']).toMatchObject({ turns: 1, input: 11, output: 6 })
  })
})

it('localDay usa o dia local', () => {
  expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})
