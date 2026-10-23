import { addBreadcrumb, breadcrumbsIntegration, eventLoopBlockIntegration, init } from '@sentry/electron/renderer'
import { WINDOW_BLOCK_MS, WINDOW_POLL_MS } from '../../shared/windowBlock'

// Erros desta janela vão para o processo principal, que limpa o que identifica a pessoa e envia (ver
// src/main/errorReports). Importado antes de tudo em
// main.tsx, para pegar também um erro ao carregar os outros módulos. Só liga com o envio ligado lá:
// é o processo principal que põe o __SENTRY_IPC__ na janela (no pnpm dev, por exemplo, não põe).

declare global {
  interface Window {
    __SENTRY_IPC__?: unknown
  }
}

// Quadro que levou mais que isso para sair vira uma das últimas ações do relatório.
const LONG_FRAME_MS = 1000

if (window.__SENTRY_IPC__) {
  init({
    // Sem cabeçalhos de rastreamento nas requisições da janela.
    tracePropagationTargets: [],
    integrations: (defaults) => [
      // Sem as sessões (o processo principal também não manda) e sem os cliques: o registro de um
      // clique guarda textos da tela, como o título de uma conversa.
      ...defaults.filter((i) => i.name !== 'BrowserSession' && i.name !== 'Breadcrumbs'),
      breadcrumbsIntegration({ dom: false }),
      // Janela parada por 5 s (um laço sem fim, por exemplo): o processo principal pega onde ela
      // estava. O "estou viva" a cada 1 s, e não a cada 2,5 s (o padrão): com o intervalo longo, uma
      // parada de 2,6 s já disparava o aviso de 5 s.
      eventLoopBlockIntegration({ threshold: WINDOW_BLOCK_MS, pollInterval: WINDOW_POLL_MS })
    ]
  })
  watchLongFrames()
}

// Os tipos do TypeScript ainda não têm esta medição do Chromium (Long Animation Frames).
type ScriptTiming = {
  duration: number
  invoker: string
  invokerType: string
  sourceURL: string
  sourceFunctionName: string
  sourceCharPosition: number
  forcedStyleAndLayoutDuration: number
}
type LongFrame = PerformanceEntry & {
  renderStart: number
  styleAndLayoutStart: number
  blockingDuration: number
  scripts: ScriptTiming[]
}

// Quadro demorado: o Chromium já mede todo quadro, e o observador só é chamado quando um passa de
// 50 ms. O que vai é a divisão do tempo (código, layout, desenho) e quais funções do app rodaram,
// sem nenhum texto da tela. É o que diz se uma janela travada estava no código do Argus ou no
// desenho da tela; o processo principal junta isto ao aviso de travamento (ver
// src/main/errorReports).
function watchLongFrames(): void {
  if (!PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) return
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LongFrame[]) {
      if (entry.duration < LONG_FRAME_MS) continue
      const end = entry.startTime + entry.duration
      const scripts = [...entry.scripts].sort((a, b) => b.duration - a.duration)
      addBreadcrumb({
        category: 'ui.long-frame',
        level: 'warning',
        message: `Quadro de ${Math.round(entry.duration)} ms`,
        data: {
          ms: Math.round(entry.duration),
          scriptMs: Math.round(scripts.reduce((sum, s) => sum + s.duration, 0)),
          // Do começo do cálculo de estilo e layout até o fim do quadro (inclui o desenho).
          layoutMs: entry.styleAndLayoutStart ? Math.round(end - entry.styleAndLayoutStart) : 0,
          renderMs: entry.renderStart ? Math.round(end - entry.renderStart) : 0,
          scripts: scripts.slice(0, 3).map((s) => ({
            ms: Math.round(s.duration),
            layoutMs: Math.round(s.forcedStyleAndLayoutDuration),
            invoker: s.invoker,
            fn: s.sourceFunctionName,
            at: `${s.sourceURL.split('/').pop() ?? ''}:${s.sourceCharPosition}`
          }))
        }
      })
    }
  }).observe({ type: 'long-animation-frame' })
}
