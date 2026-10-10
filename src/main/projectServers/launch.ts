import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { childEnv, IS_WIN, prependPath, SYSTEM32 } from '../platform'
import { APP_MARK } from '../processScan'
import { OutputBuffer } from '../terminals/outputBuffer'
import { killTreeSync } from '../winProcesses'
import { lastLine, OUTPUT_LIMIT } from './output'
import type { ProjectScript } from './scripts'

// startedAt: quando o play iniciou (ver o "iniciando" em status.ts).
export type Started = { child: ChildProcess; output: OutputBuffer; stopping: boolean; startedAt: number }

// Servidores iniciados por este app, pela pasta real do projeto.
export const started = new Map<string, Started>()
// Iniciado daqui e saiu sem ninguém pedir: últimas linhas da saída, para dizer o motivo.
export const errors = new Map<string, string>()

// Roda o script num shell de login, em segundo plano e num grupo próprio, para encerrar o
// comando inteiro depois (pnpm + vite), como o painel de servidores faz.
// noBrowser: sem abrir o navegador sozinho (o --open ou server.open do Vite, o do Create React App),
// para a página ficar só no drawer do modo design. Os dois leem BROWSER=none.
export function launch(root: string, run: ProjectScript, noBrowser: boolean): void {
  // Sem as variáveis do Electron: um projeto Electron abriria como Node puro.
  const env = childEnv()
  // Não foi o Claude Code que rodou; a marca do app põe o servidor no painel mesmo assim.
  delete env.CLAUDECODE
  env[APP_MARK] = '1'
  if (noBrowser) env.BROWSER = 'none'
  prependPath(env, [])

  errors.delete(root)
  // Mac: -i também, porque nvm e afins costumam ficar no .zshrc, que o shell só lê quando é
  // interativo. Windows: pelo cmd, que acha o pnpm/npm (.cmd) no PATH do usuário; sem janela. O
  // chcp antes põe o cmd em UTF-8: as mensagens dele ("não é reconhecido...") vinham na página de
  // código antiga do console, com os acentos trocados.
  const child = IS_WIN
    ? spawn(process.env.ComSpec || join(SYSTEM32, 'cmd.exe'), ['/d', '/s', '/c', `chcp 65001>nul & ${run.command}`], {
        cwd: root,
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    : spawn(process.env.SHELL || '/bin/zsh', ['-ilc', `exec ${run.command}`], {
        cwd: root,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
  const entry: Started = { child, output: new OutputBuffer(OUTPUT_LIMIT), stopping: false, startedAt: Date.now() }
  // Texto já decodificado: um acento partido entre dois pedaços não vira lixo.
  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  const keep = (data: string) => entry.output.push(data)
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  let done = false
  const finish = (failed: boolean) => {
    if (done) return
    done = true
    if (started.get(root) === entry) started.delete(root)
    if (failed && !entry.stopping) errors.set(root, lastLine(entry.output.text()) || `${run.command} parou`)
  }
  child.on('error', (err) => {
    keep(err.message)
    finish(true)
  })
  // Encerrado por sinal (daqui, do painel ou de um terminal) não é erro; código diferente de zero é.
  child.on('exit', (code, signal) => finish(signal === null && code !== 0))
  started.set(root, entry)
}

// O app fechando: os servidores iniciados daqui rodam escondidos e ficariam soltos.
export function stopStartedServers(): void {
  for (const entry of started.values()) {
    entry.stopping = true
    if (!entry.child.pid) continue
    if (IS_WIN) {
      killTreeSync(entry.child.pid)
      continue
    }
    try {
      process.kill(-entry.child.pid, 'SIGTERM')
    } catch {
      // Já saiu.
    }
  }
}
