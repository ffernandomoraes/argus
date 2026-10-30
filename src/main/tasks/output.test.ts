import { mkdirSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { backgroundTaskOf } from '../../shared/backgroundTasks'
import { completeUtf8, readTaskOutput, taskOutputFile } from './output'

// A saída de um comando em segundo plano é lida do arquivo que o Claude Code grava, aos pedaços.
let n = 0
const SESSION = '5e4479ab-a0be-4f15-8f49-a0c0e5f10ff4'

function outputFile(text: string, id = 'b2q9h22xw'): string {
  const dir = join(process.env.HOME ?? '', `out${++n}`, SESSION, 'tasks')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.output`)
  writeFileSync(file, text)
  return file
}

const ref = (outputFile: string, taskId = 'b2q9h22xw') => ({ cwd: '/p', sessionId: SESSION, taskId, outputFile })

describe('backgroundTaskOf', () => {
  it('lê o id e o arquivo do comando, e o id do monitor', () => {
    expect(
      backgroundTaskOf('Command running in background with ID: bwz9. Output is being written to: /private/tmp/claude-501/-p/s/tasks/bwz9.output. You will be notified when it completes.')
    ).toEqual({ id: 'bwz9', outputFile: '/private/tmp/claude-501/-p/s/tasks/bwz9.output' })
    expect(backgroundTaskOf('Monitor started (task bl7lk83t5, expires in 30m unless the source ends first)')).toEqual({ id: 'bl7lk83t5' })
    expect(backgroundTaskOf('ok')).toBeNull()
  })
})

describe('taskOutputFile', () => {
  it('só aceita <...>/tasks/<id>.output, sem "..", com o id da tarefa', async () => {
    const file = outputFile('x')
    expect(await taskOutputFile(ref(file))).toBe(file)
    expect(await taskOutputFile(ref('/etc/passwd'))).toBeNull()
    // Com o separador do sistema: no Windows, "/tasks/" não aparece e o caminho sairia sem ".." (fc360b3).
    expect(await taskOutputFile(ref(file.replace(`${sep}tasks${sep}`, `${sep}tasks${sep}..${sep}tasks${sep}`)))).toBeNull()
    expect(await taskOutputFile(ref(file, 'outra'))).toBeNull()
  })
})

describe('readTaskOutput', () => {
  it('lê do começo e depois só o que o arquivo ganhou', async () => {
    const file = outputFile('linha 1\n')
    const first = await readTaskOutput(ref(file), 0)
    expect(first).toEqual({ text: 'linha 1\n', offset: 8, reset: false, missing: false })
    writeFileSync(file, 'linha 1\nlinha 2\n')
    expect((await readTaskOutput(ref(file), first.offset)).text).toBe('linha 2\n')
  })

  it('arquivo que encolheu recomeça do zero; o que sumiu avisa', async () => {
    const file = outputFile('abc')
    expect(await readTaskOutput(ref(file), 10)).toMatchObject({ text: 'abc', reset: true })
    expect(await readTaskOutput(ref(file.replace('b2q9h22xw', 'zz'), 'zz'), 0)).toMatchObject({ missing: true })
  })

  it('caractere cortado no fim fica para a próxima leitura', () => {
    const bytes = Buffer.from('ação', 'utf8')
    expect(completeUtf8(bytes.subarray(0, 2)).toString()).toBe('a')
    expect(completeUtf8(bytes).toString()).toBe('ação')
  })
})
