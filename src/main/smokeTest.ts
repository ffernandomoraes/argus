import { appendFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import type { Terminals } from './terminals'

// Teste de fumaça do instalador: `Argus --smoke-test` abre o app, espera o canvas montar, abre um
// terminal com o shell do sistema (pelo node-pty, a parte nativa que mais quebra) e fecha o app pelo
// caminho normal, com o terminal aberto. Sai com 0 se tudo subiu e fechou sem cair, outro código se
// não. Roda no GitHub Actions, numa máquina Windows, antes de o .exe ir para o release: ninguém do
// projeto tem Windows para conferir à mão. O relato fica em argus-smoke.log, na pasta temporária.
export const SMOKE_TEST = process.argv.includes('--smoke-test')

const LOG = join(tmpdir(), 'argus-smoke.log')
const TIMEOUT_MS = 120_000
// Fechar leva uns 2 s no Windows (espera os terminais); mais que isso é travamento.
const QUIT_TIMEOUT_MS = 15_000
const KEY = 'smoke-test'

function log(line: string): void {
  try {
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Sem onde gravar: o código de saída ainda conta.
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// quit: fecha o app como quem fecha a janela, sem a pergunta de confirmação.
export function runSmokeTest(win: BrowserWindow, terminals: Terminals, canvasReady: () => boolean, quit: () => void): void {
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
    if (!ok) return app.exit(1)
    // O terminal fica aberto: fechar com ele é o que quem usa faz. Cair aqui também reprova.
    log('fechando o app')
    setTimeout(() => {
      log('FALHOU: o app não terminou de fechar')
      app.exit(2)
    }, QUIT_TIMEOUT_MS)
    quit()
  }
  app.on('before-quit', () => log('before-quit'))
  app.on('will-quit', () => log('will-quit'))
  app.on('quit', (_e, code) => log(`quit (código ${code})`))
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
