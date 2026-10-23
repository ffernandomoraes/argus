import type { CanUseTool, PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import type { PermissionRequest } from '../../shared/chat'
import { PendingPermissions } from './permissions'

type Options = Parameters<CanUseTool>[2]

const RULE = { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'ls:*' }], behavior: 'allow', destination: 'session' } as PermissionUpdate

const options = (id: string, patch: Partial<Options> = {}): Options =>
  ({ toolUseID: id, signal: new AbortController().signal, suggestions: [RULE], ...patch }) as Options

function setup() {
  const asked: PermissionRequest[] = []
  const settled: string[] = []
  const p = new PendingPermissions((r) => asked.push(r), (id) => settled.push(id))
  return { p, asked, settled }
}

describe('PendingPermissions', () => {
  it('o pedido aparece no chat com o comando e a opção de sempre permitir', async () => {
    const { p, asked } = setup()
    void p.canUseTool('Bash', { command: 'ls -la', description: 'Listar' }, options('t1'))
    expect(asked[0]).toMatchObject({ id: 't1', toolName: 'Bash', label: 'Comando', summary: 'Listar', detail: 'ls -la', canAlwaysAllow: true })
    expect(p.size).toBe(1)
  })

  it('permitir libera a ferramenta com a entrada que ela pediu, sem criar regra', async () => {
    const { p, settled } = setup()
    const result = p.canUseTool('Bash', { command: 'ls' }, options('t1'))
    p.answer('t1', 'allow')
    expect(await result).toEqual({ behavior: 'allow', updatedInput: { command: 'ls' } })
    expect(settled).toEqual(['t1'])
    expect(p.size).toBe(0)
  })

  it('"sempre permitir" manda a regra sugerida pelo Claude Code', async () => {
    const { p } = setup()
    const result = p.canUseTool('Bash', { command: 'ls' }, options('t1'))
    p.answer('t1', 'always')
    expect(await result).toEqual({ behavior: 'allow', updatedInput: { command: 'ls' }, updatedPermissions: [RULE] })
  })

  it('sem regra segura para sugerir, "sempre" não vira permissão maior que a pedida', async () => {
    const { p, asked } = setup()
    const result = p.canUseTool('Bash', { command: 'rm -rf x' }, options('t1', { suppressAlwaysAllowRule: true }))
    expect(asked[0].canAlwaysAllow).toBe(false)
    p.answer('t1', 'always')
    expect(await result).not.toHaveProperty('updatedPermissions')
  })

  it('negar devolve o aviso para o Claude', async () => {
    const { p } = setup()
    const result = p.canUseTool('Write', { file_path: '/a' }, options('t1'))
    p.answer('t1', 'deny')
    expect(await result).toMatchObject({ behavior: 'deny' })
  })

  it('as respostas das perguntas vão junto da entrada da ferramenta', async () => {
    const { p, asked } = setup()
    const questions = [{ question: 'Qual?', header: 'Q', multiSelect: false, options: [] }]
    const result = p.canUseTool('AskUserQuestion', { questions }, options('t1'))
    expect(asked[0].questions).toEqual(questions)
    p.answer('t1', { answers: { 'Qual?': 'A' } })
    expect(await result).toEqual({ behavior: 'allow', updatedInput: { questions, answers: { 'Qual?': 'A' } } })
  })

  it('pedido interrompido some da tela', () => {
    const { p, settled } = setup()
    const abort = new AbortController()
    void p.canUseTool('Bash', { command: 'ls' }, options('t1', { signal: abort.signal }))
    abort.abort()
    expect(settled).toEqual(['t1'])
    expect(p.size).toBe(0)
  })

  it('conversa fechada nega tudo que esperava, inclusive as perguntas das etapas delegadas', async () => {
    const { p } = setup()
    const tool = p.canUseTool('Bash', { command: 'ls' }, options('t1'))
    const step = p.ask({ id: 'ext', toolName: 'x', label: 'x', summary: '', canAlwaysAllow: false })
    p.denyAll('Conversa fechada.')
    expect(await tool).toEqual({ behavior: 'deny', message: 'Conversa fechada.' })
    expect(await step).toBe('deny')
    expect(p.size).toBe(0)
  })

  it('resposta para pedido que já saiu não faz nada', () => {
    const { p, settled } = setup()
    p.answer('nenhum', 'allow')
    expect(settled).toEqual([])
  })
})
