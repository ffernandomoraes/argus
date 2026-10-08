import { appendFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import type { Terminals } from './terminals'

// Teste de fumaça do instalador: `Argus --smoke-test` abre o app, espera o canvas montar, abre um
// terminal com o shell do sistema (pelo node-pty, a parte nativa que mais quebra) e sai com 0 se
// tudo subiu, 1 se não. Roda no GitHub Actions, numa máquina Windows, antes de o .exe ir para o
// release: ninguém do projeto tem Windows para conferir à mão. O relato fica em argus-smoke.log, na
// pasta temporária.
export const SMOKE_TEST = process.argv.includes('--smoke-test')

const LOG = join(tmpdir(), 'argus-smoke.log')
const TIMEOUT_MS = 120_000
const KEY = 'smoke-test'

function log(line: string): void {
  try {
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Sem onde gravar: o código de saída ainda conta.
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function runSmokeTest(win: BrowserWindow, terminals: Terminals, canvasReady: () => boolean): void {
  try {
    writeFileSync(LOG, '')
  } catch {
    // idem
  }
  let finished = false
  const finish = (ok: boolean, why: string) => {
    if (finished) return
    finished = true
    log(`${ok ? 'OK' : 'FALHOU'}: ${why}`)
    terminals.kill(KEY)
    app.exit(ok ? 0 : 1)
  }
  setTimeout(() => finish(false, 'tempo esgotado'), TIMEOUT_MS)
  process.on('uncaughtException', (err) => finish(false, `erro no processo principal: ${err.stack ?? err}`))
  win.webContents.on('preload-error', (_e, path, err) => finish(false, `preload ${path}: ${err.stack ?? err.message}`))
  win.webContents.on('render-process-gone', (_e, details) => finish(false, `a janela caiu: ${details.reason}`))
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error') log(`console: ${e.message} (${e.sourceId}:${e.lineNumber})`)
  })

  void (async () => {
    // O canvas avisa que montou pelo mesmo sinal do comando `argus` (cli:ready).
    while (!canvasReady()) await wait(250)
    log('canvas montado')
    const opened = terminals.open({ key: KEY, cwd: homedir(), shell: true, cols: 80, rows: 24 })
    if (!opened.ok) return finish(false, `terminal: ${opened.error}`)
    // Pedir de novo o mesmo terminal devolve o que ele já escreveu (o prompt do shell).
    for (let i = 0; i < 60; i++) {
      await wait(500)
      const again = terminals.open({ key: KEY, cwd: homedir(), shell: true, cols: 80, rows: 24 })
      if (again.ok && again.buffer.trim()) {
        log(`terminal respondeu: ${JSON.stringify(again.buffer.slice(-200))}`)
        return finish(true, 'app, canvas e terminal subiram')
      }
    }
    finish(false, 'o terminal abriu, mas não escreveu nada')
  })()
}
