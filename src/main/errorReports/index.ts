import { randomUUID } from 'node:crypto'
import { app, type WebContents } from 'electron'
import * as Sentry from '@sentry/electron/main'
import { isAppFrame } from '../app/appUrl'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import { errorMessage } from '../lib/errors'
import { IS_LINUX, IS_MAC, IS_WIN } from '../platform'
import { SMOKE_TEST } from '../smokeTest'
import { claudeDistro, knownDistros } from '../wsl'
import { scrubBreadcrumb, scrubEvent } from './scrub'
import {
  echoOfMainLag,
  hiddenWindowBlock,
  powerBreadcrumb,
  throttledWindowBlock,
  watchCpuThrottle,
  watchMainLag,
  watchWindowVisibility,
  withSnapshot
} from './snapshot'

export { setAppState } from './snapshot'

// Relatórios de erro, pelo Sentry: erros, quedas e travamentos de todas as instalações vão sozinhos.
//
// O que vai: onde o erro aconteceu (a pilha de funções e as últimas ações), a versão do app, o
// sistema e se há WSL. O que não vai: conversas, arquivos, chaves, e-mails, o nome da máquina e o do
// usuário (ver scrub.ts). Ficam desligadas as variáveis das funções e as fotos da memória das quedas
// (minidumps), que poderiam ter trechos de conversa, e os cabeçalhos de rastreamento que o SDK poria
// nas requisições do app para fora.
//
// Só no app instalado: no pnpm dev nada é enviado. No teste de fumaça (CI) tudo liga, inclusive a
// detecção de travamento, mas para um endereço local: nada sai da máquina (ver smokeTest.ts).

const DSN = 'https://14a538cce001830ec181d715e261f0b7@o221905.ingest.us.sentry.io/4512302375960576'
// Endereço do teste de fumaça: o teste escuta nele para conferir que um travamento vira relatório.
export const SMOKE_REPORTS_PORT = 47999
const SMOKE_DSN = `http://smoke@127.0.0.1:${SMOKE_REPORTS_PORT}/1`
// Processo principal parado por mais que isso conta como travamento (o Windows marca a janela como
// "Não está respondendo" com 5 s).
const BLOCK_MS = 5000

const SYSTEM = IS_WIN ? 'windows' : IS_MAC ? 'macos' : IS_LINUX ? 'linux' : process.platform

let active = false
let blockStatus = 'desligada'

// Bem no começo do processo principal, antes do app ficar pronto: o SDK prepara as janelas para
// mandarem os erros delas para cá.
export function startErrorReports(): void {
  if (!app.isPackaged) return
  const settings = loadAppSettings()
  const installId = settings.installId ?? saveAppSettings({ installId: randomUUID() }).installId
  try {
    Sentry.init({
      dsn: SMOKE_TEST ? SMOKE_DSN : DSN,
      // ARGUS_SENTRY_DEBUG=1: o SDK conta no console o que está fazendo (para investigar o envio).
      debug: !!process.env.ARGUS_SENTRY_DEBUG,
      // Pelo preload que o SDK põe nas janelas, e não por um protocolo próprio, que a política de
      // segurança das janelas barraria.
      ipcMode: Sentry.IPCMode.Classic,
      tracePropagationTargets: [],
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
        graphQL: { document: false, variables: false },
        databaseQueryData: false,
        queues: false
      },
      // A lista inteira aqui, e não a padrão do SDK: uma versão nova dele que passe a coletar mais
      // não entra sem passar por esta lista. Fora: minidumps, fotos da tela, variáveis das funções e
      // sessões.
      defaultIntegrations: false,
      integrations: [
        Sentry.electronBreadcrumbsIntegration({ powerMonitor: powerBreadcrumb }),
        Sentry.electronNetIntegration(),
        Sentry.electronContextIntegration(),
        // Janela ou processo do Electron que caiu vira relatório (sem o minidump, só o motivo).
        Sentry.childProcessIntegration({ events: ['abnormal-exit', 'launch-failed', 'integrity-failure', 'crashed', 'oom'] }),
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.preloadInjectionIntegration(),
        Sentry.additionalContextIntegration(),
        Sentry.gpuContextIntegration(),
        // Janela travada (o código dela parado): avisada pela própria janela (ver renderer/errorReports.ts).
        // A pilha vem do depurador, que pausa a janela na hora: o caminho nativo, sem depurador,
        // precisa de um cabeçalho na página que o file:// não tem.
        Sentry.rendererEventLoopBlockIntegration(),
        Sentry.eventFiltersIntegration(),
        Sentry.functionToStringIntegration(),
        Sentry.linkedErrorsIntegration(),
        Sentry.consoleIntegration(),
        Sentry.nativeNodeFetchIntegration(),
        Sentry.onUnhandledRejectionIntegration(),
        Sentry.contextLinesIntegration(),
        Sentry.nodeContextIntegration({ cloudResource: false }),
        Sentry.normalizePathsIntegration()
      ],
      transport: smokeSafeTransport,
      // Junta o retrato do app na hora (ver snapshot.ts) e depois limpa tudo, inclusive o retrato. O
      // aviso de janela travada que é só eco do processo principal parado, ou de uma janela escondida
      // ou com a CPU segurada pelo sistema que responde (alarme falso), não vai (ver echoOfMainLag,
      // hiddenWindowBlock e throttledWindowBlock).
      beforeSend: async (event) =>
        echoOfMainLag(event) || (await hiddenWindowBlock(event)) || (await throttledWindowBlock(event))
          ? null
          : scrubEvent(tagged(await withSnapshot(event))),
      beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      initialScope: { user: { id: installId } },
      maxBreadcrumbs: 60,
      getRendererName: rendererName
    })
    active = true
  } catch (err) {
    console.error('[erros] o envio de erros não ligou:', errorMessage(err))
    return
  }
  watchRenderers()
  watchMainLag()
  watchWindowVisibility(rendererName)
  void app.whenReady().then(() => {
    watchCpuThrottle()
    startBlockDetection()
  })
}

// No teste de fumaça, nada sai pelo SDK (o travamento vai pela linha de execução à parte, para o
// endereço local).
const smokeSafeTransport: ReturnType<typeof Sentry.makeElectronOfflineTransport> = (options) => {
  const base = Sentry.makeElectronOfflineTransport()(options)
  return SMOKE_TEST ? { send: () => Promise.resolve({}), flush: () => Promise.resolve(true) } : base
}

// Onde o erro aconteceu: sistema, arquitetura e, no Windows, se há WSL, se o Claude Code roda nele e
// se o erro cita uma pasta de lá. O nome e a versão do sistema o SDK já manda.
function tagged(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const wslPath = IS_WIN && /[\\/]{2}wsl(?:\.localhost|\$)[\\/]/i.test(JSON.stringify(event))
  event.tags = {
    ...event.tags,
    system: SYSTEM,
    arch: process.arch,
    ...(IS_WIN && {
      wsl: knownDistros().length ? 'yes' : 'no',
      'wsl.claude': claudeDistro() ? 'yes' : 'no',
      'wsl.path': wslPath ? 'yes' : 'no'
    })
  }
  return event
}

function rendererName(contents: WebContents): string {
  const hash = contents.getURL().split('#')[1] ?? ''
  return hash === 'mascot' ? 'mascot' : hash.startsWith('popout/') ? 'conversation' : 'canvas'
}

// Mensagens de erro e aviso do console das janelas do app (e falhas ao carregar) entram nas últimas
// ações: é o que explica uma janela que não terminou de abrir.
function watchRenderers(): void {
  app.on('web-contents-created', (_e, wc) => {
    wc.on('console-message', (e) => {
      if ((e.level !== 'error' && e.level !== 'warning') || !isAppFrame(e.frame)) return
      Sentry.addBreadcrumb({
        category: 'renderer.console',
        level: e.level,
        message: e.message,
        data: { source: `${e.sourceId}:${e.lineNumber}` }
      })
    })
    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      if (isMainFrame) Sentry.addBreadcrumb({ category: 'renderer.load', level: 'error', message: `${description} (${code})`, data: { url } })
    })
    wc.on('preload-error', (_e, path, error) => {
      Sentry.addBreadcrumb({ category: 'renderer.preload', level: 'error', message: errorMessage(error), data: { path } })
    })
  })
}

// Travamento do processo principal: uma linha de execução à parte confere o processo principal e,
// parado por BLOCK_MS, manda onde ele estava. Ela envia direto, sem o beforeSend: os caminhos do app
// saem relativos à pasta dele, e as últimas ações já são guardadas limpas (beforeBreadcrumb).
function startBlockDetection(): void {
  // require, e não import: é o mesmo SDK já carregado acima (com import seria outra cópia, sem o
  // cliente). Sem o binário compilado para o Electron (scripts/sentryNative.mjs), lança aqui e o app
  // segue sem a detecção.
  try {
    const native = require('@sentry/electron/native') as typeof import('@sentry/electron/native')
    Sentry.addIntegration(native.eventLoopBlockIntegration({ threshold: BLOCK_MS, staticTags: { system: SYSTEM, arch: process.arch } }))
    // A integração só passa a vigiar no primeiro aviso da thread principal, BLOCK_MS / 2 depois de
    // ligar: um travamento logo na abertura (a janela presa carregando) passaria sem ser visto. Este
    // aviso adiantado, depois do registro dela (no setImmediate dela), começa a vigiar na hora.
    setImmediate(() => {
      try {
        ;(require('@sentry/node-native-stacktrace') as { threadPoll: (enabled: boolean, state: object) => void }).threadPoll(true, {})
      } catch (err) {
        console.warn('[erros] primeiro aviso da detecção de travamento:', errorMessage(err))
      }
    })
    blockStatus = 'ligada'
  } catch (err) {
    blockStatus = `desligada (${errorMessage(err)})`
    console.warn('[erros] sem a detecção de travamento:', errorMessage(err))
  }
}

// A abertura deu errado (ver app/crashGuard.ts): o que o SDK não vê sozinho.
export function reportOpeningProblem(message: string, extra: Record<string, unknown> = {}): void {
  if (active) Sentry.captureMessage(message, { level: 'fatal', tags: { opening: 'failed' }, extra })
}

// Algo parou sem dar erro (o uso do Claude sem atualizar, por exemplo): vai como aviso, com o estado
// de quem parou. Sem isso, a causa só aparece se cair num travamento, nos últimos minutos dele.
export function reportWarning(message: string, extra: Record<string, unknown> = {}): void {
  if (active) Sentry.captureMessage(message, { level: 'warning', extra })
}

// Para o relato do teste de fumaça.
export function errorReportsStatus(): string {
  return active ? `envio de erros ligado, detecção de travamento ${blockStatus}` : 'envio de erros desligado'
}
