import { performance } from 'node:perf_hooks'
import { app, BrowserWindow, ipcMain, type WebContents } from 'electron'
import * as Sentry from '@sentry/electron/main'
import { WINDOW_BLOCK_MS, WINDOW_POLL_MS } from '../../shared/windowBlock'

// O retrato do app na hora de um erro: tudo lido só quando um relatório sai, nada medido sem parar.
// A exceção é o relógio de 1 s do processo principal (ver watchMainLag), que só confere a hora.
// Só números e estados: nenhum título, caminho ou texto de conversa.

// O que o app estava fazendo (conversas abertas, terminais), lido na hora do erro. Quem sabe disso
// são os serviços, criados depois do envio de erros ligar (ver src/main/index.ts).
let readAppState: () => Record<string, unknown> = () => ({})
export const setAppState = (read: () => Record<string, unknown>): void => {
  readAppState = read
}

// Atraso do processo principal: um relógio de 1 s confere se rodou na hora. Parado (um trabalho
// longo no processo principal), o "estou viva" das janelas também chega atrasado, e o aviso de
// travamento da janela é alarme falso (ver echoOfMainLag).
const TICK_MS = 1000
const LAG_KEEP_MS = 60_000
let lastTick = performance.now()
const lags: { at: number; ms: number }[] = []

export function watchMainLag(): void {
  setInterval(() => {
    const now = performance.now()
    const ms = Math.round(now - lastTick - TICK_MS)
    lastTick = now
    while (lags.length && now - lags[0].at > LAG_KEEP_MS) lags.shift()
    if (ms < 200) return
    lags.push({ at: now, ms })
    if (ms >= 1000) Sentry.addBreadcrumb({ category: 'main.lag', level: 'warning', message: `Processo principal parado por ${ms} ms` })
  }, TICK_MS).unref()
}

function mainLag(): Record<string, number> {
  const now = performance.now()
  return {
    // Parado agora, desde o último tique do relógio.
    nowMs: Math.max(0, Math.round(now - lastTick - TICK_MS)),
    worstLastMinuteMs: lags.reduce((worst, l) => Math.max(worst, l.ms), 0)
  }
}

// CPU e memória de cada processo do app (a CPU é a média desde a leitura anterior; na primeira, 0).
function processes(): Record<string, unknown>[] {
  return app.getAppMetrics().map((p) => ({
    type: p.type,
    cpu: Math.round(p.cpu.percentCPUUsage),
    memoryMB: Math.round(p.memory.workingSetSize / 1024)
  }))
}

function windows(): Record<string, number | boolean> {
  const all = BrowserWindow.getAllWindows()
  return {
    open: all.length,
    focused: !!BrowserWindow.getFocusedWindow(),
    minimized: all.filter((w) => !w.isDestroyed() && w.isMinimized()).length
  }
}

function safely<T>(read: () => T): T | { error: string } {
  try {
    return read()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// Janela travada (o aviso que o processo principal gera pela janela): espera ela voltar e mandar o
// quadro demorado (ver src/renderer/src/errorReports.ts), que diz onde o tempo foi. Sem ele em 15 s
// (a janela continua parada) ou com o app fechando, o aviso vai sem.
const FRAME_WAIT_MS = 15_000
let quitting = false
app.once('before-quit', () => (quitting = true))
const isWindowBlock = (event: Sentry.ErrorEvent): boolean =>
  event.exception?.values?.[0]?.mechanism?.type === 'ANR' && !!event.tags?.['event.process']

function longFrameNear(event: Sentry.ErrorEvent): Sentry.Breadcrumb | undefined {
  const at = event.timestamp ?? Date.now() / 1000
  return Sentry.getCurrentScope()
    .getScopeData()
    .breadcrumbs.filter((b) => b.category === 'ui.long-frame' && (b.data?.ms ?? 0) >= 3000 && (b.timestamp ?? 0) >= at - 30)
    .pop()
}

async function waitLongFrame(event: Sentry.ErrorEvent): Promise<Sentry.Breadcrumb | undefined> {
  const until = Date.now() + FRAME_WAIT_MS
  for (;;) {
    const frame = longFrameNear(event)
    if (frame || quitting || Date.now() >= until) return frame
    await new Promise((r) => setTimeout(r, 250))
  }
}

// Eco do processo principal parado: o vigia da janela roda nele e conta o tempo desde o último
// "estou viva" dela, que só chega com o processo principal rodando. Se ele ficou parado logo antes
// do aviso o bastante para estourar o limite sozinho (o limite menos o intervalo do sinal), quem
// travou foi ele, e o travamento dele já vai em relatório próprio quando passa de 5 s. Sem tique do
// relógio desde a parada, vale o atraso de agora.
const JUST_BEFORE_MS = 3000

export function echoOfMainLag(event: Sentry.ErrorEvent): boolean {
  if (!isWindowBlock(event)) return false
  const now = performance.now()
  const recent = lags.filter((l) => now - l.at <= JUST_BEFORE_MS).reduce((worst, l) => Math.max(worst, l.ms), 0)
  return Math.max(recent, now - lastTick - TICK_MS) >= WINDOW_BLOCK_MS - WINDOW_POLL_MS
}

// Janela escondida (coberta por outra, minimizada, tela bloqueada): o Chromium segura os relógios
// dela, e depois de 5 min só os solta uma vez por minuto. O "estou viva" atrasa e o vigia acusa
// travamento, mesmo com a janela parada à toa. O SDK desliga o vigia ao perder o foco e ao bloquear
// a tela, mas religa ao desbloquear, ao acordar o computador e no foco, com a janela ainda escondida:
// 2026-10-27 (ARGUS-1 e ARGUS-5), um aviso por minuto depois de desbloquear a tela; 2026-10-26
// (ARGUS-7), no instante em que a janela reapareceu depois de o Mac acordar. A janela conta quando
// some e reaparece (ver src/renderer/src/errorReports.ts), pela mesma mensagem que o vigia do SDK
// lê ('sentry-ipc.status', o canal padrão dele).
const visibility = new Map<number, { contents: WebContents; name: string; hidden: boolean; shownAt: number }>()
let nameOf: (contents: WebContents) => string = () => ''

export function watchWindowVisibility(name: (contents: WebContents) => string): void {
  nameOf = name
  ipcMain.on('sentry-ipc.status', (e, message: { status?: unknown } | undefined) => {
    const status = message?.status
    if (status !== 'visible' && status !== 'hidden') return
    const contents = e.sender
    const was = visibility.get(contents.id)
    if (!was) contents.once('destroyed', () => visibility.delete(contents.id))
    visibility.set(contents.id, {
      contents,
      name: nameOf(contents),
      hidden: status === 'hidden',
      shownAt: status === 'visible' && was?.hidden ? performance.now() : (was?.shownAt ?? -Infinity)
    })
  })
}

// Escondida não basta: travada, a janela também não avisa que reapareceu, e o travamento de verdade
// de uma janela que parou escondida (a pessoa volta a ela e encontra tudo parado) seria descartado
// junto. 2026-10-27: no app, minimizada, travada por 25 s e restaurada no meio, o aviso não ia. Por
// isso a pergunta: parada à toa, ela responde na hora (o Chromium segura os relógios dela, não as
// mensagens); travada, não responde.
const PING_MS = 1000

function responds(contents: WebContents): Promise<boolean> {
  if (contents.isDestroyed()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), PING_MS)
    const answered = () => {
      clearTimeout(timer)
      resolve(true)
    }
    contents.executeJavaScript('0').then(answered, answered)
  })
}

// Aviso de uma janela escondida agora, ou que reapareceu há menos que o limite (parte do tempo sem
// sinal foi escondida), que responde: alarme falso. Pelo nome, que é o que o aviso traz: com duas
// janelas de mesmo nome, todas precisam responder.
export async function hiddenWindowBlock(event: Sentry.ErrorEvent): Promise<boolean> {
  if (!isWindowBlock(event)) return false
  const now = performance.now()
  const same = [...visibility.values()].filter((w) => w.name === event.tags?.['event.process'])
  if (!same.some((w) => w.hidden || now - w.shownAt < WINDOW_BLOCK_MS)) return false
  return allRespond(same.map((w) => w.contents))
}

const allRespond = async (contents: WebContents[]): Promise<boolean> =>
  (await Promise.all(contents.map(responds))).every(Boolean)

// Quando uma janela do Argus ganhou o foco (ver unfocusedWindowBlock).
let focusedAt = -Infinity

export function watchWindowFocus(): void {
  app.on('browser-window-focus', () => (focusedAt = performance.now()))
}

// O aviso sai depois de 5 s sem o "estou viva" da janela, e só conta se esse silêncio inteiro foi com
// uma janela do Argus em foco: alguém usando o app, com a janela à vista. O SDK já desliga o vigia
// quando a janela perde o foco, mas o religa sozinho ao acordar o computador e ao desbloquear a tela,
// sem olhar foco nem visibilidade. Minimizada, atrás de outras ou com a tela bloqueada, a janela tem o
// "estou viva" segurado pelo Chromium (uma vez por minuto depois de 5 min): o vigia acusava travamento
// a cada minuto, por horas, e também no instante em que a pessoa voltava à janela. Perguntar à janela
// se responde (hiddenWindowBlock) e olhar a CPU segurada pelo sistema deixavam passar avisos assim.
// 2026-10-29: ARGUS-1, 4,9 s depois de o notebook acordar às 3h com a tela bloqueada; ARGUS-5, 5 s
// depois de desbloquear a tela com a janela minimizada; 2026-10-27 (ARGUS-1), 22 ms depois de a janela
// ganhar o foco. Travamento que começa com a janela em foco chega aqui com 5 s ou mais de foco.
export function unfocusedWindowBlock(event: Sentry.ErrorEvent): boolean {
  return isWindowBlock(event) && (!BrowserWindow.getFocusedWindow() || performance.now() - focusedAt < WINDOW_BLOCK_MS)
}

// Nas últimas ações, a mudança de limite da CPU e a do estado térmico entram no máximo uma vez por
// minuto cada: em sequência, ocupavam as 60 vagas, e o que explicaria o travamento sumia (ARGUS-1,
// 2026-10-28). O filtro de eventos do powerMonitor que a integração de ações do SDK aceita.
const NOISY_POWER_EVENTS = ['speed-limit-change', 'thermal-state-change']
const POWER_BREADCRUMB_MS = 60_000
const powerBreadcrumbAt = new Map<string, number>()

export function powerBreadcrumb(name: string): boolean {
  if (!NOISY_POWER_EVENTS.includes(name)) return true
  const now = performance.now()
  if (now - (powerBreadcrumbAt.get(name) ?? -Infinity) < POWER_BREADCRUMB_MS) return false
  powerBreadcrumbAt.set(name, now)
  return true
}

export async function withSnapshot(event: Sentry.ErrorEvent): Promise<Sentry.ErrorEvent> {
  // Antes de qualquer espera: o atraso de agora é o que interessa.
  const lag = mainLag()
  const frame = isWindowBlock(event) ? await waitLongFrame(event) : undefined
  event.contexts = {
    ...event.contexts,
    'main thread': lag,
    ...(frame && { 'long frame': frame.data }),
    'app state': {
      ...safely(readAppState),
      windows: safely(windows),
      gpu: safely(() => app.getGPUFeatureStatus()),
      processes: safely(processes)
    }
  }
  return event
}
