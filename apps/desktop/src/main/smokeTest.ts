import { appendFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import { errorMessage } from './lib/errors'
import type { Terminals } from './terminals'
import { shellKind } from './terminals/shellIntegration'

// Teste de fumaça do instalador: `Argus --smoke-test` abre o app, espera o canvas montar, abre um
// terminal com o shell do sistema (pelo node-pty, a parte nativa que mais quebra), confere as marcas
// da integração do shell e fecha o app pelo caminho normal, com o terminal aberto. Sai com 0 se tudo subiu e fechou sem cair, outro código se
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

// Relatórios de erro (ver errorReports): como ficou o envio e o endereço local para onde o teste
// manda os relatórios.
export type SmokeReports = { status: () => string; port: number }

// Travamento vira relatório: com o processo principal parado mais que o limite, a linha de execução
// à parte do Sentry manda onde ele estava. No teste o endereço é este servidor local, e nada sai da
// máquina. Só relata: sem o binário do detector, o app funciona, só sem esse aviso.
async function blockReported(port: number): Promise<string> {
  let got = false
  const server = createServer((req, res) => {
    if (req.method === 'POST') got = true
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
  } catch (err) {
    return `não conferido (porta ${port}: ${errorMessage(err)})`
  }
  try {
    // O detector sobe logo depois do app ficar pronto; um respiro antes de travar.
    await wait(1000)
    const until = Date.now() + 7000
    while (Date.now() < until) {
      // Parado de propósito.
    }
    for (let i = 0; i < 20 && !got; i++) await wait(500)
    return got ? 'virou relatório' : 'não virou relatório'
  } finally {
    server.close()
  }
}

// A integração do shell (terminals/shellIntegration.ts): o prompt marcado e o fim de um comando, com o
// código de saída. É por ela que o Claude sabe quando termina o comando que roda no terminal do
// drawer; o script do PowerShell só se confere aqui, no Windows do GitHub.
async function shellMarks(terminals: Terminals): Promise<{ ok: boolean; text: string }> {
  const a = terminals.activity(KEY)
  const shell = terminals.shellOf(KEY)
  if (!a?.integrated)
    return shell?.path && shellKind(shell.path) ? { ok: false, text: `${shell.name} abriu sem a integração` } : { ok: true, text: `sem integração (${shell?.name ?? '?'})` }
  for (let i = 0; i < 60 && !a.marked; i++) await wait(500)
  if (!a.marked) return { ok: false, text: 'o prompt não foi marcado' }
  const offset = terminals.outputEnd(KEY)
  terminals.write(KEY, 'echo argus-smoke\r')
  for (let i = 0; i < 60; i++) {
    const end = a.markAfter('D', offset)
    if (end) return { ok: end.exitCode === 0, text: `fim do comando marcado (código ${end.exitCode ?? '?'})` }
    await wait(250)
  }
  return { ok: false, text: 'o fim do comando não foi marcado' }
}

// quit: fecha o app como quem fecha a janela, sem a pergunta de confirmação.
export function runSmokeTest(win: BrowserWindow, terminals: Terminals, canvasReady: () => boolean, quit: () => void, reports: SmokeReports): void {
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
    const opened = await terminals.open({ key: KEY, cwd: homedir(), shell: true, cols: 80, rows: 24 })
    if (!opened.ok) return finish(false, `terminal: ${opened.error}`)
    // Pedir de novo o mesmo terminal devolve o que ele já escreveu (o prompt do shell).
    for (let i = 0; i < 60; i++) {
      await wait(500)
      const again = await terminals.open({ key: KEY, cwd: homedir(), shell: true, cols: 80, rows: 24 })
      if (again.ok && again.buffer.trim()) {
        log(`terminal respondeu: ${JSON.stringify(again.buffer.slice(-200))}`)
        const marks = await shellMarks(terminals)
        log(`marcas do shell: ${marks.text}`)
        if (!marks.ok) return finish(false, `marcas do shell: ${marks.text}`)
        log(reports.status())
        log(`travamento: ${await blockReported(reports.port)}`)
        return finish(true, 'app, canvas e terminal subiram')
      }
    }
    finish(false, 'o terminal abriu, mas não escreveu nada')
  })()
}
