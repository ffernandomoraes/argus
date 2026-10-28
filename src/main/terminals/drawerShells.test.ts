import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// As ferramentas como o SDK as recebe: o nome e a função que atende a chamada.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, _description: string, _schema: unknown, handler: unknown) => ({ name, handler }),
  createSdkMcpServer: (options: unknown) => options
}))
// Os cortes da saída no Mac e no Linux (no Windows a marca de fim chega adiantada, ver drawerShells.ts).
vi.mock('../platform', async (original) => ({ ...(await original<typeof import('../platform')>()), IS_WIN: false }))

import type { Terminals } from '.'
import { argusMcp, initDrawerShells, linkDrawerShell, readsOwnOutput } from './drawerShells'
import { OutputBuffer } from './outputBuffer'
import { ShellActivity } from './shellActivity'

const N = 'n0nce'
const A = `\x1b]133;A;nonce=${N}\x07`
const C = `\x1b]133;C;nonce=${N}\x07`
const D = (code: number) => `\x1b]133;D;${code};nonce=${N}\x07`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Handler = (args: object, extra: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>

// Um shell do drawer de mentira: o que ele imprime vai pelo emit, o que a pessoa digita pelo type, e o
// que o Claude digita cai em writes (e no onWrite, que responde como o shell).
let count = 0
class FakeShell {
  key = `shell-${++count}`
  conversation = `conversa-${count}`
  output = new OutputBuffer(200_000)
  activity = new ShellActivity(N)
  writes: string[] = []
  sizes = [{ at: 0, cols: 80, rows: 24 }]
  // false: o ConPTY do sistema, no Windows, que reescreve a saída (ver spawnPty).
  passthrough = true
  front = 'zsh'
  shellPath = '/nao/existe/zsh'
  onWrite: (data: string) => void = () => {}

  constructor(prompt = true) {
    initDrawerShells({ terminals: this.terminals(), typed: () => {}, open: () => {} })
    linkDrawerShell(this.key, [this.conversation])
    if (prompt) this.emit(`${A}$ `)
  }

  emit(data: string): void {
    const start = this.output.end
    this.output.push(data)
    this.activity.output(data, start)
  }

  type(data: string): void {
    this.activity.person(data, this.output.end)
  }

  // A pessoa muda o tamanho do painel; o ConPTY do Windows redesenha a tela inteira do topo.
  resize(cols: number, rows: number, repaint: string): void {
    this.sizes.push({ at: this.output.end, cols, rows })
    this.emit(repaint)
  }

  terminals(): Terminals {
    return {
      has: (key: string) => key === this.key,
      activity: () => this.activity,
      saved: () => ({ ...this.output.saved(), sizes: this.sizes }),
      outputEnd: () => this.output.end,
      passthrough: () => this.passthrough,
      shellOf: () => ({ name: 'zsh', path: this.shellPath, pid: 1 }),
      foreground: () => this.front,
      write: (_key: string, data: string) => {
        this.writes.push(data)
        this.onWrite(data)
      }
    } as unknown as Terminals
  }

  tool(name: string) {
    const server = argusMcp(() => [this.conversation]) as unknown as { tools: { name: string; handler: Handler }[] }
    const handler = server.tools.find((t) => t.name === name)!.handler
    return async (args: object) => {
      const result = await handler(args, {})
      return { text: result.content[0].text, error: !!result.isError }
    }
  }
}

describe('rodar_no_terminal', () => {
  it('espera a marca de fim e devolve só a saída do comando, com o código', async () => {
    const shell = new FakeShell()
    shell.onWrite = () => setTimeout(() => shell.emit(`ls\r\n${C}a.txt\r\nb.txt\r\n${D(0)}${A}$ `), 10)
    const result = await shell.tool('rodar_no_terminal')({ comando: 'ls' })
    expect(result).toMatchObject({ error: false })
    expect(result.text).toContain('O comando terminou com código 0.')
    expect(result.text).toContain('a.txt\nb.txt')
    expect(result.text).not.toContain('$ ls')
    expect(shell.writes).toEqual(['ls\r'])
  })

  it('comando que falha sem imprimir nada: o código e "sem saída"', async () => {
    const shell = new FakeShell()
    shell.onWrite = () => setTimeout(() => shell.emit(`false\r\n${C}${D(1)}${A}$ `), 10)
    const result = await shell.tool('rodar_no_terminal')({ comando: 'false' })
    expect(result.text).toContain('O comando terminou com código 1.')
    expect(result.text).toContain('(sem saída)')
  })

  it('comando que imprime e fica quieto (um servidor) volta como rodando, com a saída até ali', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const shell = new FakeShell()
      shell.onWrite = () => setTimeout(() => shell.emit(`pnpm dev\r\n${C}Local: http://localhost:5173\r\n`), 10)
      const running = shell.tool('rodar_no_terminal')({ comando: 'pnpm dev' })
      // Depois de digitado e de a saída chegar, o relógio anda 6 s.
      while (!shell.output.text().includes('Local:')) await sleep(20)
      vi.setSystemTime(Date.now() + 6_000)
      const result = await running
      expect(result.text).toContain('O comando continua rodando')
      expect(result.text).toContain('Local: http://localhost:5173')
    } finally {
      vi.useRealTimers()
    }
  })

  it('outro programa na frente do shell: recusa sem digitar', async () => {
    const shell = new FakeShell()
    shell.emit(`pnpm dev\r\n${C}servidor no ar\r\n`)
    shell.front = 'node'
    const result = await shell.tool('rodar_no_terminal')({ comando: 'ls' })
    expect(result.error).toBe(true)
    expect(result.text).toContain('`node`')
    expect(shell.writes).toEqual([])
  })

  it('programa rodando sem marca de começo (um `(pnpm dev)` no bash): vale o da frente, e recusa', async () => {
    const shell = new FakeShell()
    shell.front = 'node'
    const result = await shell.tool('rodar_no_terminal')({ comando: 'ls' })
    expect(result.error).toBe(true)
    expect(shell.writes).toEqual([])
  })

  it('dentro de um ssh: digita lá e acha o fim pelo prompt de lá, que fica de fora da saída', async () => {
    const shell = new FakeShell()
    shell.emit(`ssh vps\r\n${C}user@vps:~$ `)
    shell.front = 'ssh'
    shell.onWrite = () => setTimeout(() => shell.emit('df -h\r\n/dev/sda1  20G\r\nuser@vps:~$ '), 10)
    const result = await shell.tool('rodar_no_terminal')({ comando: 'df -h' })
    expect(result.text).toContain('O comando terminou.')
    expect(result.text).toContain('user@vps:~$ df -h\n/dev/sda1  20G')
    expect(result.text.trimEnd().endsWith('20G')).toBe(true)
  }, 10_000)

  it('a pessoa digitou depois do prompt: recusa, a linha pode ter texto dela', async () => {
    const shell = new FakeShell()
    await sleep(5)
    shell.type('git sta')
    const result = await shell.tool('rodar_no_terminal')({ comando: 'ls' })
    expect(result.error).toBe(true)
    expect(result.text).toContain('A pessoa digitou')
    expect(shell.writes).toEqual([])
  })

  it.skipIf(!existsSync('/bin/zsh'))('aspas sem fechar: o zsh recusa antes, sem digitar', async () => {
    const shell = new FakeShell()
    shell.shellPath = '/bin/zsh'
    const result = await shell.tool('rodar_no_terminal')({ comando: 'echo "oi' })
    expect(result.error).toBe(true)
    expect(result.text).toContain('unmatched')
    expect(shell.writes).toEqual([])
  })

  it('mais de uma linha: recusa', async () => {
    const shell = new FakeShell()
    expect((await shell.tool('rodar_no_terminal')({ comando: 'ls\nrm -rf x' })).error).toBe(true)
    expect(shell.writes).toEqual([])
  })
})

describe('digitar_no_terminal', () => {
  it('shell recém-aberto: espera o primeiro prompt antes de digitar', async () => {
    const shell = new FakeShell(false)
    setTimeout(() => shell.emit(`${A}$ `), 100)
    const result = await shell.tool('digitar_no_terminal')({ comando: 'ls' })
    expect(result.error).toBe(false)
    expect(shell.writes).toEqual(['ls'])
  })
})

describe('read_terminal', () => {
  it('a saída do comando do Claude vai sem permissão; depois que a pessoa digita, só a tela, com permissão', async () => {
    const shell = new FakeShell(false)
    shell.emit(`${A}$ cat .env\r\n${C}TOKEN=abc\r\n${D(0)}${A}$ `)
    shell.onWrite = () => setTimeout(() => shell.emit(`ls\r\n${C}a.txt\r\n${D(0)}${A}$ `), 10)
    await shell.tool('rodar_no_terminal')({ comando: 'ls' })

    expect(readsOwnOutput([shell.conversation])).toBe(true)
    const own = await shell.tool('read_terminal')({})
    expect(own.text).toContain('a.txt')
    expect(own.text).not.toContain('TOKEN')

    shell.type('x')
    expect(readsOwnOutput([shell.conversation])).toBe(false)
    const screen = await shell.tool('read_terminal')({})
    expect(screen.text).toContain('Tela do terminal')
    // Com permissão, a tela vem inteira, mas o valor com cara de segredo não.
    expect(screen.text).toContain('TOKEN=***')
    expect(screen.text).not.toContain('abc')
  })

  it.each([true, false])('o painel mudou de tamanho depois do comando: o redesenho da tela não entra na saída (passthrough %s)', async (passthrough) => {
    const shell = new FakeShell()
    shell.passthrough = passthrough
    shell.onWrite = () => setTimeout(() => shell.emit(`ls\r\n${C}a.txt\r\nb.txt\r\n${D(0)}${A}$ `), 10)
    await shell.tool('rodar_no_terminal')({ comando: 'ls' })
    shell.resize(40, 10, '\x1b[H\x1b[2J$ ls\x1b[K\r\nlixo do redesenho\x1b[K\r\n$ ')
    const result = await shell.tool('read_terminal')({})
    expect(result.text).toContain('a.txt\nb.txt')
    expect(result.text).not.toContain('lixo')
  })

  it('só o trecho do comando: a tela de antes, o painel estreito e o que vem depois não entram', async () => {
    const shell = new FakeShell()
    // Tela bagunçada antes (cursor posicionado no meio) e o painel estreito quando o comando começa.
    shell.emit('\x1b[5;30Hresto de outro programa\x1b[2;1H')
    shell.resize(20, 5, '')
    const long = 'uma linha bem mais comprida que o painel estreito'
    shell.onWrite = () => setTimeout(() => shell.emit(`echo\r\n${C}${long}\r\nfim\r\n${D(0)}${A}$ `), 10)
    const result = await shell.tool('rodar_no_terminal')({ comando: 'echo' })
    expect(result.text).toBe(`O comando terminou com código 0.\n\n${long}\nfim`)
    shell.resize(120, 40, '\x1b[H\x1b[2Jlixo do redesenho\r\n$ ')
    expect((await shell.tool('read_terminal')({})).text).toBe(`O comando terminou com código 0.\n\n${long}\nfim`)
  })

  it('com wait_ms, espera o comando do Claude terminar', async () => {
    const shell = new FakeShell()
    shell.activity.agent = { offset: shell.output.end, at: Date.now() }
    shell.emit(`pnpm test\r\n${C}rodando...\r\n`)
    setTimeout(() => shell.emit(`3 passaram\r\n${D(0)}${A}$ `), 50)
    const result = await shell.tool('read_terminal')({ wait_ms: 5_000 })
    expect(result.text).toContain('O comando terminou com código 0.')
    expect(result.text).toContain('rodando...\n3 passaram')
  })

  it('a pessoa digita enquanto ele espera: o que veio depois dela fica de fora', async () => {
    const shell = new FakeShell()
    shell.activity.agent = { offset: shell.output.end, at: Date.now() }
    shell.emit(`pnpm dev\r\n${C}parte do Claude\r\n`)
    setTimeout(() => {
      shell.type('cat .env\r')
      shell.emit(`TOKEN=abc\r\n${D(0)}${A}$ `)
    }, 50)
    const result = await shell.tool('read_terminal')({ wait_ms: 5_000 })
    expect(result.text).toContain('parte do Claude')
    expect(result.text).not.toContain('TOKEN')
    expect(result.text).toContain('a pessoa digitou no terminal depois disso')
  })

  it('sem terminal aberto na conversa: avisa', async () => {
    const shell = new FakeShell()
    shell.conversation = 'outra-conversa'
    const result = await shell.tool('read_terminal')({})
    expect(result.error).toBe(true)
    expect(readsOwnOutput(['outra-conversa'])).toBe(false)
  })
})
