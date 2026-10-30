import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { liveSessions, liveStatusByPid, sessionIdByPid, stoppedPidOf } from './liveSessions'

// Pastas que não respondem (a do WSL com a máquina virtual travada) ou que dão erro de leitura; o
// resto lê o disco.
const fs = vi.hoisted(() => ({ silent: new Set<string>(), failing: new Set<string>() }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>()
  const readdir = (path: string, ...rest: unknown[]) => {
    if (fs.silent.has(String(path))) return new Promise(() => {})
    if (fs.failing.has(String(path))) return Promise.reject(Object.assign(new Error('EIO'), { code: 'EIO' }))
    return (real.readdir as (...args: unknown[]) => Promise<unknown>)(path, ...rest)
  }
  return { ...real, readdir }
})

afterEach(() => {
  fs.silent.clear()
  fs.failing.clear()
  vi.useRealTimers()
})

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

  // 2026-10-23: com o WSL travado, ler a pasta de status de lá segurava a lista de conversas e a
  // dos designs; e sem status, as conversas pareceriam ter parado.
  it('pasta de status que não responde: vale a última leitura dela', async () => {
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'viva', status: 'busy' })
    expect([...(await liveSessions())]).toEqual([['viva', 'running']])
    fs.silent.add(dir())
    vi.useFakeTimers()
    const live = liveSessions()
    await vi.advanceTimersByTimeAsync(5000)
    expect([...(await live)]).toEqual([['viva', 'running']])
  })

  it('erro ao ler a pasta de status também: a conversa não parece ter parado; sem a pasta, nenhum status', async () => {
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'viva', status: 'busy' })
    expect([...(await liveSessions())]).toEqual([['viva', 'running']])
    fs.failing.add(dir())
    expect([...(await liveSessions())]).toEqual([['viva', 'running']])
    fs.failing.clear()
    rmSync(dir(), { recursive: true, force: true })
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

describe('stoppedPidOf', () => {
  // O `claude` encerrado à força deixa o arquivo de status: o pid dele serve para achar no relatório
  // do macOS por que ele foi encerrado.
  it('o pid do processo que já saiu com essa sessão; o vivo e o de outra sessão não contam', async () => {
    const dead = deadPid()
    write(`${dead}.json`, { pid: dead, sessionId: 'caiu', status: 'busy' })
    write(`${process.pid}.json`, { pid: process.pid, sessionId: 'caiu', status: 'busy' })
    expect(await stoppedPidOf('caiu')).toBe(dead)
    expect(await stoppedPidOf('outra')).toBeNull()
  })
})
