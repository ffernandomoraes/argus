import { describe, expect, it } from 'vitest'
import type { RunningAgent } from '../../shared/agents'
import { finishedAgents, subagentSteps, taskChange, type TaskMessage } from './subagents'

const task = (m: Record<string, unknown>) => m as unknown as TaskMessage

const started = (id: string, extra: Record<string, unknown> = {}) =>
  task({ type: 'system', subtype: 'task_started', task_id: id, task_type: 'local_agent', tool_use_id: `tool-${id}`, description: `tarefa ${id}`, ...extra })

const agentsAfter = (messages: TaskMessage[], now = 100): RunningAgent[] =>
  messages.reduce<RunningAgent[]>((agents, m) => taskChange(agents, m, now)?.agents ?? agents, [])

describe('taskChange', () => {
  it('subagente lançado entra na lista, uma vez só', () => {
    const agents = agentsAfter([started('a', { subagent_type: 'Explore' }), started('a')])
    expect(agents).toEqual([
      { id: 'a', toolUseId: 'tool-a', agent: 'Explore', description: 'tarefa a', startedAt: 100, toolUses: 0, steps: [], background: false }
    ])
  })

  it('tarefa que não é subagente (comando em segundo plano) não entra', () => {
    expect(taskChange([], started('cmd', { task_type: 'local_bash' }), 0)).toBeNull()
  })

  it('aviso de ambiente ou fora do histórico é ignorado', () => {
    expect(taskChange([], started('a', { ambient: true }), 0)).toBeNull()
    expect(taskChange([], started('a', { skip_transcript: true }), 0)).toBeNull()
  })

  it('o progresso atualiza a frase e as ferramentas sem pressa de ir para a tela', () => {
    const agents = agentsAfter([started('a')])
    const change = taskChange(agents, task({ subtype: 'task_progress', task_id: 'a', summary: 'lendo os testes', usage: { tool_uses: 3 } }), 0)
    expect(change?.urgent).toBe(false)
    expect(change?.agents[0]).toMatchObject({ summary: 'lendo os testes', toolUses: 3 })
  })

  it('sai da lista ao terminar, falhar ou ser parado; pausado continua', () => {
    const agents = agentsAfter([started('a')])
    for (const status of ['completed', 'failed', 'killed']) {
      expect(taskChange(agents, task({ subtype: 'task_updated', task_id: 'a', patch: { status } }), 0)?.agents).toEqual([])
    }
    expect(taskChange(agents, task({ subtype: 'task_updated', task_id: 'a', patch: { status: 'paused' } }), 0)).toBeNull()
    expect(taskChange(agents, task({ subtype: 'task_notification', task_id: 'a' }), 0)?.agents).toEqual([])
  })

  it('mandado para segundo plano no meio do caminho', () => {
    const agents = agentsAfter([started('a')])
    const change = taskChange(agents, task({ subtype: 'task_updated', task_id: 'a', patch: { is_backgrounded: true } }), 0)
    expect(change?.agents[0].background).toBe(true)
  })
})

describe('subagentSteps', () => {
  it('as ferramentas do subagente entram na lista dele, guardando só as últimas 40', () => {
    const agents = agentsAfter([started('a')])
    const uses = Array.from({ length: 45 }, (_, i) => ({ type: 'tool_use', name: 'Read', input: { file_path: `/p/f${i}.ts` } }))
    const steps = subagentSteps(agents, 'tool-a', [{ type: 'text', text: 'oi' }, ...uses])?.agents[0].steps
    expect(steps).toHaveLength(40)
    expect(steps?.at(-1)).toEqual({ label: 'Ler', summary: 'f44.ts' })
  })

  it('mensagem sem ferramenta ou de outro subagente não muda nada', () => {
    const agents = agentsAfter([started('a')])
    expect(subagentSteps(agents, 'tool-a', [{ type: 'text', text: 'oi' }])).toBeNull()
    expect(subagentSteps(agents, 'tool-b', [{ type: 'tool_use', name: 'Bash', input: {} }])).toBeNull()
  })
})

describe('finishedAgents', () => {
  it('o resultado da chamada encerra o de primeiro plano; o de segundo plano segue', () => {
    const agents = agentsAfter([started('a'), started('b', { is_backgrounded: true })])
    expect(finishedAgents(agents, new Set(['tool-a', 'tool-b']))?.agents.map((a) => a.id)).toEqual(['b'])
    expect(finishedAgents(agents, new Set(['outra']))).toBeNull()
  })
})
