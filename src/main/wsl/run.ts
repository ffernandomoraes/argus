import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { app } from 'electron'
import { log } from './log'
import { WSL_EXE, ensureDistro, type DistroInfo } from './distros'
import { installInWsl } from './install'
import { toUnc } from './path'

// Roda um programa dentro do Linux do WSL, a partir do Windows. Os argumentos e as variáveis não
// passam pela linha de comando do wsl.exe: vão num arquivo (separados por \0) que um script curto
// lê, apaga e executa. Assim um --settings com JSON ou um prompt longo, com aspas e quebras de
// linha, chega ao Linux exatamente como saiu daqui, sem depender de como o wsl.exe divide a linha.
// O arquivo fica na pasta do usuário no Linux (~/.argus/run), que só ele lê.

const RUN_DIR = app.isPackaged ? '.argus/run' : '.argus-dev/run'

const SCRIPT = `# Escrito pelo Argus. Roda o programa com os argumentos guardados no arquivo e apaga o arquivo.
mapfile -d '' -t a < "$1"
rm -f "$1"
exec "\${a[@]}"
`

// Variáveis que o Claude Code do Linux precisa receber do app. O resto do ambiente do Windows
// (Path, pastas do Windows) não faz sentido lá dentro.
const PASS = /^(CLAUDE_|ANTHROPIC_|TERM$|COLORTERM$|FORCE_COLOR$|NO_COLOR$|DEBUG$|MCP_|DISABLE_|ENABLE_|OTEL_|HTTPS?_PROXY$|NO_PROXY$)/i
const SKIP = /^(CLAUDE_CODE_GIT_BASH_PATH|CLAUDE_CONFIG_DIR|CLAUDE_SECURESTORAGE_CONFIG_DIR)$/i

// Do ambiente montado para o processo, o que vai para o Linux: o que o app ou o SDK acrescentaram
// (diferente do ambiente do próprio app) e as variáveis do Claude. A pasta da conta vem à parte,
// já no formato do Linux (ver accountEnv).
export function linuxEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined || SKIP.test(k)) continue
    if (PASS.test(k) || (process.env[k] !== v && !/^path$/i.test(k) && !/[\\]|^[a-z]:/i.test(v))) out[k] = v
  }
  return out
}

const written = new Set<string>()

function prepareRunDir(distro: string, home: string): string {
  const dir = toUnc(distro, `${home}/${RUN_DIR}`)
  const script = `${dir}\\run.sh`
  if (!written.has(distro)) {
    mkdirSync(dir, { recursive: true })
    let current = ''
    try {
      current = readFileSync(script, 'utf8')
    } catch {
      // ainda não existe
    }
    if (current !== SCRIPT) writeFileSync(script, SCRIPT, { mode: 0o700 })
    written.add(distro)
  }
  return dir
}

type Listener = Parameters<EventEmitter['on']>[1]

export type WslCommand = { file: string; args: string[] }

// Programa e argumentos (para o spawn do Node ou do node-pty) que rodam `argv` na pasta `cwd` do
// Linux, com as variáveis `env` somadas ao ambiente padrão de lá e o PATH do shell de login.
export function wslCommand(distro: string, info: DistroInfo, cwd: string, argv: string[], env: Record<string, string>): WslCommand {
  const dir = prepareRunDir(distro, info.home)
  const id = randomUUID()
  const vars = Object.entries({ ...env, ...(info.path ? { PATH: info.path } : {}) }).map(([k, v]) => `${k}=${v}`)
  const all = ['/usr/bin/env', ...vars, ...argv]
  writeFileSync(`${dir}\\${id}`, all.join('\0') + '\0', { mode: 0o600 })
  const linuxDir = `${info.home}/${RUN_DIR}`
  return { file: WSL_EXE, args: ['-d', distro, '--cd', cwd, '--exec', '/bin/bash', `${linuxDir}/run.sh`, `${linuxDir}/${id}`] }
}

// Processo para o SDK (spawnClaudeCodeProcess), que pede a resposta na hora: a entrada e a saída
// ficam prontas já, e o processo de verdade abre quando o app souber onde está o `claude` daquela
// distro (na primeira vez, o wsl.exe leva uns segundos para responder).
export function deferredWslProcess(
  distro: string,
  build: (info: DistroInfo) => Promise<{ argv: string[]; env: Record<string, string>; cwd: string }>
) {
  const events = new EventEmitter()
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  let child: ChildProcess | null = null
  let killed = false
  let exitCode: number | null = null

  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (exitCode !== null) return
    exitCode = code ?? 1
    stdout.end()
    events.emit('exit', code, signal)
  }
  const fail = (message: string) => {
    log(message)
    events.emit('error', new Error(message))
    finish(1, null)
  }

  void ensureDistro(distro).then(
    async (found) => {
      if (killed) return finish(null, 'SIGTERM')
      if (!found) return fail(`Não deu para abrir o WSL (${distro}).`)
      // Sem o Claude Code na distro: instala antes (o instalador oficial, sem janela).
      const info = found.claude ? found : ((await installInWsl(distro)) ?? found)
      if (killed) return finish(null, 'SIGTERM')
      if (!info.claude) return fail(`Não deu para instalar o Claude Code no WSL (${distro}). Veja o diagnóstico nas configurações.`)
      const { argv, env, cwd } = await build(info)
      if (killed) return finish(null, 'SIGTERM')
      let cmd: WslCommand
      try {
        cmd = wslCommand(distro, info, cwd, argv, env)
      } catch (err) {
        return fail(`Não deu para preparar o WSL (${distro}): ${(err as Error).message}`)
      }
      const c = spawn(cmd.file, cmd.args, { stdio: 'pipe', windowsHide: true })
      child = c
      stdin.pipe(c.stdin)
      c.stdout.pipe(stdout, { end: false })
      let err = ''
      c.stderr.on('data', (d: Buffer) => {
        if (err.length < 2000) err += d.toString('utf8')
      })
      c.on('error', (e) => fail(`wsl.exe não abriu: ${e.message}`))
      c.on('close', (code, signal) => {
        if (code) log(`claude no WSL (${distro}) saiu com ${code}`, err.slice(0, 500))
        finish(code, signal)
      })
    },
    (err: Error) => fail(err.message)
  )

  return {
    stdin,
    stdout,
    get killed() {
      return killed
    },
    get exitCode() {
      return exitCode
    },
    kill(signal: NodeJS.Signals) {
      killed = true
      if (child) return child.kill(signal)
      return true
    },
    on: (event: string, listener: Listener) => void events.on(event, listener),
    once: (event: string, listener: Listener) => void events.once(event, listener),
    off: (event: string, listener: Listener) => void events.off(event, listener)
  }
}
