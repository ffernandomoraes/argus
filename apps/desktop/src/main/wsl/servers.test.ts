import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

// Parar o servidor do projeto que roda no WSL. O número do grupo de processos fica num arquivo no
// Linux: lê-lo pela pasta de rede, do Windows, travava o app inteiro enquanto o WSL respondia, e
// fechar o app esperava até 5 s por servidor. Agora tudo roda lá dentro, e ao fechar não se espera.

const calls = vi.hoisted(() => ({
  spawned: [] as { file: string; args: string[]; options: Record<string, unknown> }[],
  execFile: [] as string[][],
  unref: 0
}))

vi.mock('electron', () => ({ app: { isPackaged: true } }))
vi.mock('./distros', () => ({ WSL_EXE: 'wsl.exe', ensureDistro: async () => ({ home: '/home/ana', path: '', claude: null }) }))
vi.mock('./run', () => ({ wslCommand: async () => ({ file: 'wsl.exe', args: ['servidor'] }) }))
vi.mock('./log', () => ({ log: vi.fn() }))
vi.mock('node:fs', () => ({ readFileSync: () => assert(), rmSync: () => assert() }))
vi.mock('node:child_process', () => ({
  spawn: (file: string, args: string[], options: Record<string, unknown>) => {
    calls.spawned.push({ file, args, options })
    return Object.assign(new EventEmitter(), { kill: vi.fn(), unref: () => calls.unref++ })
  },
  execFile: (_file: string, args: string[], _options: unknown, done: (err: Error | null) => void) => {
    calls.execFile.push(args)
    done(null)
  },
  execFileSync: () => assert()
}))

// Nada pela pasta de rede nem esperando o wsl.exe.
function assert(): never {
  throw new Error('chamada síncrona ao WSL')
}

import { launchInWsl, type WslServer } from './servers'

async function launch(): Promise<WslServer> {
  calls.spawned.length = 0
  calls.execFile.length = 0
  calls.unref = 0
  const server = await launchInWsl('Ubuntu', '/home/ana/proj', 'pnpm dev')
  if (typeof server === 'string') throw new Error(server)
  return server
}

describe('servidor no WSL', () => {
  it('fechando o app: dispara o encerramento no Linux sem esperar, e fecha o wsl.exe', async () => {
    const server = await launch()
    server.stopSync()
    const kill = calls.spawned[1]
    expect(kill.options).toMatchObject({ detached: true, stdio: 'ignore' })
    expect(calls.unref).toBe(1)
    expect(kill.args.slice(0, 5)).toEqual(['-d', 'Ubuntu', '--exec', 'sh', '-c'])
    // Lê o grupo, encerra o grupo inteiro e apaga o arquivo, lá dentro.
    expect(kill.args[5]).toMatch(/^p=\$\(cat '\/home\/ana\/\.argus\/run\/server-[\w-]+\.pid' 2>\/dev\/null\) && kill -TERM -- "-\$p"; rm -f '/)
    expect(server.child.kill).toHaveBeenCalled()
  })

  it('pelo botão de parar: espera o encerramento no Linux e fecha o wsl.exe', async () => {
    const server = await launch()
    await server.stop()
    expect(calls.execFile).toHaveLength(1)
    expect(calls.execFile[0].slice(0, 5)).toEqual(['-d', 'Ubuntu', '--exec', 'sh', '-c'])
    expect(server.child.kill).toHaveBeenCalled()
  })
})
