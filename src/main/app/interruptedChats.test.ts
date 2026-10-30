import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ChatState } from '../../shared/chat'
import type { ChatEntry } from '../chats/entries'
import { InterruptedChats } from './interruptedChats'

// Atualizar o Argus com conversas trabalhando: ao abrir de novo, elas apareciam paradas, iguais a
// qualquer conversa antiga, e não dava para saber o que tinha ficado no meio.

const state = (patch: Partial<ChatState> = {}): ChatState => ({
  status: 'idle',
  partial: '',
  permissions: [],
  revision: 0,
  turnTokens: 0,
  agents: [],
  backgroundTasks: 0,
  ...patch
})

const entry = (sessionId: string, status: ChatState['status'], cwd = '/p'): ChatEntry => ({ id: sessionId, cwd, state: state({ status, sessionId }) })
const fileIn = () => join(mkdtempSync(join(tmpdir(), 'interrupted-')), 'interruptedChats.json')
const ids = (m: InterruptedChats) => m.list().map((c) => c.sessionId)

describe('InterruptedChats', () => {
  it('o que trabalhava quando o app fechou aparece interrompido na abertura seguinte', () => {
    const file = fileIn()
    const before = new InterruptedChats(file, () => undefined)
    before.update([entry('a', 'running'), entry('b', 'needs-you'), entry('c', 'idle')])
    before.freeze()
    // A saída encerra as conversas: elas param, mas continuam marcadas.
    before.update([entry('a', 'idle'), entry('b', 'idle'), entry('c', 'idle')])

    const after = new InterruptedChats(file, () => undefined)
    expect(ids(after)).toEqual(['a', 'b'])
    expect(after.list()[0]).toEqual({ sessionId: 'a', cwd: '/p' })
  })

  it('também depois de uma queda, sem passar pela saída do app', () => {
    const file = fileIn()
    new InterruptedChats(file, () => undefined).update([entry('a', 'running')])
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual(['a'])
  })

  it('a que parou sozinha antes de fechar não fica marcada', () => {
    const file = fileIn()
    const before = new InterruptedChats(file, () => undefined)
    before.update([entry('a', 'running')])
    before.update([entry('a', 'idle')])
    before.freeze()
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual([])
  })

  it('voltar a trabalhar (continuar ou mensagem nova) tira a marca e avisa', () => {
    const file = fileIn()
    new InterruptedChats(file, () => undefined).update([entry('a', 'running'), entry('b', 'running')])
    const onChange = vi.fn()
    const after = new InterruptedChats(file, onChange)
    after.update([entry('a', 'running')])
    expect(ids(after)).toEqual(['b'])
    expect(onChange).toHaveBeenCalledTimes(1)
    // E segue guardado assim: fechar de novo com "a" trabalhando marca ela outra vez.
    after.freeze()
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual(['b', 'a'])
  })

  it('o X do aviso tira a marca de vez', () => {
    const file = fileIn()
    new InterruptedChats(file, () => undefined).update([entry('a', 'running')])
    const onChange = vi.fn()
    const after = new InterruptedChats(file, onChange)
    after.dismiss('a')
    after.dismiss('a')
    expect(ids(after)).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual([])
  })

  it('o Claude encerrado sem memória no meio de uma resposta fica interrompido, com o motivo guardado', () => {
    const file = fileIn()
    const onChange = vi.fn()
    const m = new InterruptedChats(file, onChange)
    m.update([entry('a', 'running')])
    m.mark('a', '/p', 'memory')
    // O processo caiu: a conversa para, e a marca continua.
    m.update([entry('a', 'idle')])
    expect(m.list()).toEqual([{ sessionId: 'a', cwd: '/p', reason: 'memory' }])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(new InterruptedChats(file, () => undefined).list()).toEqual([{ sessionId: 'a', cwd: '/p', reason: 'memory' }])
  })

  it('arquivo estragado ou de formato estranho vira lista vazia, sem quebrar', () => {
    const file = fileIn()
    writeFileSync(file, '{ não é json')
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual([])
    writeFileSync(file, JSON.stringify({ interrupted: [{ sessionId: 1 }, null, { sessionId: 'x', cwd: '/q' }], running: 'a' }))
    expect(ids(new InterruptedChats(file, () => undefined))).toEqual(['x'])
  })

  it('só grava quando muda quem está trabalhando', () => {
    const file = fileIn()
    const m = new InterruptedChats(file, () => undefined)
    m.update([entry('a', 'running')])
    writeFileSync(file, 'marca')
    m.update([entry('a', 'running')])
    m.update([entry('a', 'needs-you')])
    expect(readFileSync(file, 'utf8')).toBe('marca')
  })
})
