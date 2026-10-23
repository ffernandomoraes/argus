import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { liveSessions, liveStatusByPid, sessionIdByPid } from './liveSessions'

// Cada Claude Code aberto grava ~/.claude/sessions/<pid>.json. O pid deste processo de teste está
// vivo; o de um processo que já terminou, não.
const dir = () => join(process.env.HOME ?? '', '.claude', 'sessions')
const write = (name: string, body: unknown) => writeFileSync(join(dir(), name), typeof body === 'string' ? body : JSON.stringify(body))
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid ?? 999_999_999

beforeEach(() => {
  rmSync(dir(), { recursive: true, force: true })
  mkdirSync(dir(), { recursive: true })
})

describe('liveSessions', () => {
  it('traduz o status do Claude Code e ignora processo que já saiu', async () => {
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'viva', status: 'waiting' })
    const dead = deadPid()
    write(`${dead}.json`, { pid: dead, sessionId: 'morta', status: 'busy' })
    const live = await liveSessions()
    expect([...live]).toEqual([['viva', 'needs-you']])
  })

  it('arquivo pela metade, sem sessão, de outro nome ou status desconhecido não quebra', async () => {
    write('123.json', '{"pid":')
    write('notas.json', { pid: process.pid, sessionId: 'x', status: 'busy' })
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'nova', status: 'algo-novo' })
    expect([...(await liveSessions())]).toEqual([['nova', 'idle']])
  })

  it('pid 0 ou negativo nunca vale (seria um grupo de processos)', async () => {
    write('0.json', { pid: 0, sessionId: 'zero', status: 'busy' })
    write('1.json', { pid: -1, sessionId: 'negativo', status: 'busy' })
    expect((await liveSessions()).size).toBe(0)
  })
})

describe('liveStatusByPid e sessionIdByPid', () => {
  it('acha o status e a sessão pelo pid do terminal', () => {
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'do-terminal', status: 'busy' })
    expect(liveStatusByPid().get(process.pid)).toBe('running')
    expect(sessionIdByPid(process.pid)).toBe('do-terminal')
    expect(sessionIdByPid(-5)).toBeNull()
  })
})
