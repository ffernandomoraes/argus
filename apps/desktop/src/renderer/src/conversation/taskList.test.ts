import { describe, expect, it } from 'vitest'
import { mergeTasks } from './taskList'

// As abas do drawer das tarefas: a que termina não some, e a aberta pelo chat entra mesmo parada.
const running = (id: string, description = id) => ({ id, description, type: 'local_bash', startedAt: 1 })

describe('mergeTasks', () => {
  it('a tarefa que terminou fica na aba; a nova entra no fim', () => {
    const first = mergeTasks([], [running('a'), running('b')], undefined)
    const after = mergeTasks(first, [running('b'), running('c')], undefined)
    expect(after.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('a aberta pelo chat entra com o comando, e a descrição da lista vale mais', () => {
    const list = mergeTasks([], [running('a', 'Sobe o servidor')], { id: 'a', description: 'pnpm dev', command: 'pnpm dev' })
    expect(list).toEqual([{ id: 'a', description: 'Sobe o servidor', command: 'pnpm dev', startedAt: 1 }])
  })

  it('sem mudança, a mesma lista', () => {
    const list = mergeTasks([], [running('a')], undefined)
    expect(mergeTasks(list, [running('a')], undefined)).toBe(list)
  })
})
