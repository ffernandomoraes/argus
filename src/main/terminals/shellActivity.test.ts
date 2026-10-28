import { describe, expect, it } from 'vitest'
import { isPersonInput, ShellActivity } from './shellActivity'

const N = 'n0nce'
const A = `\x1b]133;A;nonce=${N}\x07`
const C = `\x1b]133;C;nonce=${N}\x07`
const D = (code: number) => `\x1b]133;D;${code};nonce=${N}\x07`

describe('isPersonInput', () => {
  it('as respostas automáticas do xterm não contam como a pessoa digitando', () => {
    for (const report of ['\x1b[12;1R', '\x1b[?1;2c', '\x1b[>0;276;0c', '\x1b[0n', '\x1b[?2004;2$y', '\x1b[I', '\x1b[O', '\x1b]11;rgb:1e1e/1e1e/1e1e\x07', '\x1bP>|xterm.js(6.0.0)\x1b\\'])
      expect(isPersonInput(report), JSON.stringify(report)).toBe(false)
  })

  it('teclas, setas, Ctrl+C e colagem contam', () => {
    for (const keys of ['l', '\r', '\x1b[A', '\x03', '\x1b[200~ls\x1b[201~', '\x1b[12;1Rx']) expect(isPersonInput(keys), JSON.stringify(keys)).toBe(true)
  })
})

describe('ShellActivity', () => {
  it('sem marcas ainda: começando; depois, no prompt ou rodando pela última marca', () => {
    const a = new ShellActivity(N)
    expect(a.integrated).toBe(true)
    expect(a.marked).toBe(false)
    expect(a.phase).toBe('starting')
    a.output(`${A}$ `, 0)
    expect(a.marked).toBe(true)
    expect(a.phase).toBe('prompt')
    a.output(`ls\r\n${C}`, 100)
    expect(a.phase).toBe('running')
    a.output(`a.txt\r\n${D(0)}${A}$ `, 200)
    expect(a.phase).toBe('prompt')
  })

  it('acha a primeira marca de um tipo a partir de uma posição', () => {
    const a = new ShellActivity(N)
    a.output(`${A}$ `, 0)
    a.output(`${C}x\r\n${D(3)}${A}`, 50)
    expect(a.markAfter('D', 50)).toMatchObject({ kind: 'D', exitCode: 3 })
    expect(a.markAfter('A', 1)?.start).toBeGreaterThan(50)
    expect(a.markAfter('C', 10_000)).toBeUndefined()
  })

  it('a primeira tecla da pessoa depois do comando do Claude marca onde a saída deixa de ser só dele', () => {
    const a = new ShellActivity(N)
    a.agent = { offset: 10, at: Date.now() }
    a.person('\x1b[12;1R', 40)
    expect(a.agent.personCut).toBeUndefined()
    a.person('q', 50)
    a.person('w', 80)
    expect(a.agent.personCut).toBe(50)
  })

  it('sem nonce não há integração nem marcas', () => {
    const a = new ShellActivity()
    a.output(A, 0)
    expect(a.integrated).toBe(false)
    expect(a.marked).toBe(false)
  })

  it('next acorda com saída nova antes do prazo', async () => {
    const a = new ShellActivity(N)
    const started = Date.now()
    const waiting = a.next(5_000)
    setTimeout(() => a.output('oi', 0), 20)
    await waiting
    expect(Date.now() - started).toBeLessThan(1_000)
  })
})
