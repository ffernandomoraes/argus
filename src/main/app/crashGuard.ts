import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { reportOpeningProblem } from '../errorReports'
import { tr } from '../i18n'
import { writeJsonAtomicSync, readJsonFile } from '../lib/jsonFile'
import { errorMessage } from '../lib/errors'
import { SMOKE_TEST } from '../smokeTest'
import { recordHealthEvent } from '../systemHealth'
import { Updater } from '../updater'
import { isCanvasReady, isCanvasWindow } from './canvasRegistry'
import { showMessageBox } from './messageBox'

// Quando uma versão quebra o app, oferece voltar para a anterior (baixada do GitHub) ou procurar
// uma mais nova, com a correção. Conta como quebra:
// - a janela do canvas cair (render-process-gone), a qualquer hora;
// - o canvas não montar em OPENING_MS depois de abrir;
// - erro sem tratamento no processo principal enquanto o app abre;
// - o app morrer de vez na abertura: nada roda nessa hora, então a abertura deixa uma marca no
//   disco e a apaga quando o canvas monta (ou o app fecha). Achada a marca da mesma versão na
//   próxima abertura, o aviso vem antes de tudo.
// Só no app instalado: em desenvolvimento ele não se atualiza, e no teste de fumaça (CI) uma
// janela esperando resposta travaria o job.

const OPENING_MS = 30_000
const marker = () => join(app.getPath('userData'), 'opening.json')
const enabled = () => app.isPackaged && !SMOKE_TEST

type Recovery = { updater: Updater; restart: () => Promise<void> }

let recovery: Recovery | null = null
let asking = false
let opened = false

// Logo na partida, antes de criar os serviços: um erro neles já cai aqui. Devolve se a abertura
// anterior desta mesma versão não chegou ao fim.
export function armCrashGuard(): boolean {
  if (!enabled()) return false
  const last = readJsonFile<{ version?: unknown }>(marker())
  const crashedBefore = last.status === 'ok' && last.data?.version === app.getVersion()
  try {
    writeJsonAtomicSync(marker(), { version: app.getVersion() })
  } catch {
    // Sem a marca, só a próxima quebra forte passa sem aviso.
  }
  process.on('uncaughtException', onMainError)
  app.on('render-process-gone', (_e, wc, details) => {
    if (details.reason === 'clean-exit' || !isCanvasWindow(BrowserWindow.fromWebContents(wc))) return
    // Sem memória: diz isso, e fica também no aviso da barra de cima.
    const oom = details.reason === 'oom'
    if (oom) recordHealthEvent({ kind: 'windowCrashed' })
    void offerRecovery(
      'crash',
      oom
        ? tr('A janela do canvas fechou por falta de memória.', 'The canvas window closed for lack of memory.')
        : tr(`A janela do canvas caiu (${details.reason}).`, `The canvas window crashed (${details.reason}).`)
    )
  })
  // Fechar no meio da abertura não é quebra.
  app.on('will-quit', finishOpening)
  return crashedBefore
}

// Com os serviços prontos, a volta passa pelo mesmo "Reiniciar e atualizar" (pergunta antes de
// fechar o que estiver rodando).
export function attachRecovery(updater: Updater, restart: () => Promise<void>): void {
  recovery = { updater, restart }
}

// A abertura anterior quebrou: pergunta antes de abrir as janelas. true: seguir abrindo.
export async function askAfterCrash(): Promise<boolean> {
  return offerRecovery('lastOpening', tr('O Argus fechou sozinho enquanto abria.', 'Argus closed unexpectedly while opening.'), {
    message: 'A abertura anterior não terminou (o app fechou ou travou enquanto abria)'
  })
}

// O canvas tem OPENING_MS para montar. Montou: a abertura deu certo.
export function watchOpening(win: BrowserWindow | null): void {
  if (!enabled()) return
  if (!win) return finishOpening()
  const started = Date.now()
  const timer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(timer)
      return
    }
    if (isCanvasReady(win.webContents)) {
      clearInterval(timer)
      finishOpening()
    } else if (Date.now() - started > OPENING_MS) {
      clearInterval(timer)
      const wc = win.webContents
      void offerRecovery('crash', tr('A janela do canvas não terminou de carregar.', "The canvas window didn't finish loading."), {
        message: 'A janela do canvas não terminou de carregar',
        extra: { loading: wc.isLoading(), crashed: wc.isCrashed(), url: wc.getURL() }
      })
    }
  }, 500)
}

function finishOpening(): void {
  if (opened) return
  opened = true
  process.off('uncaughtException', onMainError)
  rmSync(marker(), { force: true })
}

function onMainError(err: Error): void {
  console.error('[app] erro na abertura:', err)
  void offerRecovery('crash', errorMessage(err))
}

// Sem os serviços (o erro foi ao criá-los), um atualizador só para a volta, que troca o app
// direto, sem a pergunta de fechar.
function getRecovery(): Recovery {
  if (!recovery) {
    const updater = new Updater(() => {})
    recovery = { updater, restart: () => updater.installAsync(true).then(() => {}) }
  }
  return recovery
}

type Kind = 'crash' | 'lastOpening'

// O que vira relatório de erro (ver errorReports). Erros e quedas o SDK pega sozinho; aqui vai o que
// ele não vê: a janela que não terminou de carregar e a abertura anterior que não terminou.
type OpeningReport = { message: string; extra?: Record<string, unknown> }

// Mostra as opções até uma dar certo ou o usuário desistir. true: seguir com o app aberto.
async function offerRecovery(kind: Kind, reason: string, report?: OpeningReport): Promise<boolean> {
  if (asking) return true
  asking = true
  try {
    await app.whenReady()
    const { updater, restart } = getRecovery()
    const current = app.getVersion()
    if (report) reportOpeningProblem(report.message, report.extra)
    for (;;) {
      const { response } = await showMessageBox({
        type: 'warning',
        message: kind === 'lastOpening' ? tr('O Argus não abriu direito da última vez', "Argus didn't open properly last time") : tr('O Argus parou de funcionar', 'Argus stopped working'),
        detail: tr(
          `Pode ser um problema da versão ${current}. Você pode voltar para a versão anterior ou procurar uma versão mais nova, com a correção.\n\n${reason}`,
          `This may be a problem with version ${current}. You can go back to the previous version or check for a newer one with the fix.\n\n${reason}`
        ),
        buttons: [
          tr('Voltar para a versão anterior', 'Go Back to Previous Version'),
          tr('Procurar versão nova', 'Check for New Version'),
          kind === 'lastOpening' ? tr('Abrir mesmo assim', 'Open Anyway') : tr('Fechar o Argus', 'Quit Argus')
        ],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      })
      if (response === 2) {
        if (kind === 'crash') app.quit()
        return kind === 'lastOpening'
      }
      const done = response === 0 ? await goBack(updater, restart) : await checkNewer(updater, restart)
      if (done) return false
    }
  } finally {
    asking = false
  }
}

async function goBack(updater: Updater, restart: () => Promise<void>): Promise<boolean> {
  try {
    const version = await whileWaiting(tr('Baixando a versão anterior', 'Downloading the previous version'), updater.rollback())
    return await install(updater, restart, version)
  } catch (err) {
    await failed(tr('Não deu para voltar para a versão anterior.', "Couldn't go back to the previous version."), err)
    return false
  }
}

async function checkNewer(updater: Updater, restart: () => Promise<void>): Promise<boolean> {
  try {
    const state = await whileWaiting(
      tr('Procurando uma versão nova', 'Checking for a new version'),
      updater.settled().then(() => updater.check())
    )
    if (state.status === 'ready') return await install(updater, restart, state.version)
    const message =
      state.status === 'latest' ? tr(`Ainda não há versão mais nova que a ${app.getVersion()}.`, `There's no version newer than ${app.getVersion()} yet.`)
      : state.status === 'error' || state.status === 'waiting' ? state.message
      : state.status === 'unsupported' ? state.reason
      : tr('Não deu para baixar a versão nova agora.', "Couldn't download the new version right now.")
    await showMessageBox({ type: 'info', message, buttons: ['OK'] })
  } catch (err) {
    await failed(tr('Não deu para procurar uma versão nova.', "Couldn't check for a new version."), err)
  }
  return false
}

// Reinicia com a versão baixada. true: a troca começou, ou ficou para quando o app fechar (o
// usuário respondeu "Cancelar" à pergunta de fechar o que estava rodando).
async function install(updater: Updater, restart: () => Promise<void>, version: string): Promise<boolean> {
  await restart()
  if (updater.swapping) return true
  const state = updater.state
  if (state.status === 'error') {
    await failed(tr(`Não deu para instalar a versão ${version}.`, `Couldn't install version ${version}.`), state.message)
    return false
  }
  await showMessageBox({
    type: 'info',
    message: tr(`A versão ${version} está baixada.`, `Version ${version} is downloaded.`),
    detail: tr('Ela entra quando o Argus fechar.', 'It will be installed when Argus quits.'),
    buttons: ['OK']
  })
  return true
}

// Aviso de espera enquanto baixa: fechá-lo não cancela, e ele some sozinho no fim. No Mac, sem
// janela do Argus em foco (a recuperação antes das janelas abrirem), ele fica solto e síncrono (ver
// messageBox.ts): só fecha no OK, e o download só anda depois disso.
async function whileWaiting<T>(message: string, work: Promise<T>): Promise<T> {
  const abort = new AbortController()
  void showMessageBox({
    type: 'info',
    message: `${message}…`,
    detail: tr('O Argus reabre sozinho quando terminar.', 'Argus will reopen by itself when it finishes.'),
    buttons: ['OK'],
    signal: abort.signal
  }).catch(() => {})
  try {
    return await work
  } finally {
    abort.abort()
  }
}

async function failed(message: string, err: unknown): Promise<void> {
  await showMessageBox({ type: 'error', message, detail: errorMessage(err), buttons: ['OK'] })
}
