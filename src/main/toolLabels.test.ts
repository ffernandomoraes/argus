import { describe, expect, it } from 'vitest'
import { describeTool } from './toolLabels'

describe('describeTool', () => {
  it('Bash: a descrição do Claude na linha, o comando no detalhe', () => {
    expect(describeTool('Bash', { command: 'ls -la\npwd', description: 'Listar arquivos' })).toEqual({ label: 'Comando', summary: 'Listar arquivos', detail: 'ls -la\npwd' })
    expect(describeTool('Bash', { command: 'ls -la\npwd' }).summary).toBe('ls -la')
  })

  it('arquivos: o nome na linha, com caminho de Mac ou de Windows', () => {
    expect(describeTool('Read', { file_path: '/Users/ana/proj/src/a.ts' })).toMatchObject({ label: 'Ler', summary: 'a.ts', detail: '/Users/ana/proj/src/a.ts' })
    expect(describeTool('Edit', { file_path: 'C:\\Users\\ana\\proj\\b.ts' }).summary).toBe('b.ts')
  })

  it('busca, página e subagente', () => {
    expect(describeTool('Grep', { pattern: 'TODO', path: '/p/src' }).summary).toBe('“TODO” em src')
    expect(describeTool('WebFetch', { url: 'https://www.example.com/a?b=1' }).summary).toBe('example.com')
    expect(describeTool('Agent', { description: 'Explorar', prompt: 'procura tudo' })).toMatchObject({ label: 'Subagente', summary: 'Explorar', detail: 'procura tudo' })
  })

  it('plano: o título na linha, o markdown inteiro no detalhe', () => {
    const plan = '# Prévia do plano\n\n## Passos\n1. Fazer'
    expect(describeTool('ExitPlanMode', { plan })).toEqual({ label: 'Plano pronto', summary: 'Prévia do plano', detail: plan })
    expect(describeTool('ExitPlanMode', {})).toMatchObject({ summary: '', detail: undefined })
  })

  it('MCP: "servidor - ação", e os do próprio Argus com nome próprio', () => {
    expect(describeTool('mcp__sentry__search_issues', { query: 'erro' })).toEqual({ label: 'sentry - search issues', summary: 'erro' })
    expect(describeTool('mcp__argus__rodar_no_terminal', { comando: 'pnpm dev' })).toMatchObject({ label: 'Rodar no terminal', summary: 'pnpm dev' })
  })

  it('ferramenta desconhecida ou sem entrada não quebra', () => {
    expect(describeTool('NovaFerramenta', { foo: 'bar' })).toEqual({ label: 'NovaFerramenta', summary: 'bar' })
    expect(describeTool('Read', undefined)).toMatchObject({ label: 'Ler', summary: '' })
  })
})
