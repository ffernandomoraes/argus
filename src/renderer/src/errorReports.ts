import { breadcrumbsIntegration, eventLoopBlockIntegration, init } from '@sentry/electron/renderer'

// Erros desta janela vão para o processo principal, que limpa o que identifica a pessoa e envia (ver
// src/main/errorReports). Importado antes de tudo em
// main.tsx, para pegar também um erro ao carregar os outros módulos. Só liga com o envio ligado lá:
// é o processo principal que põe o __SENTRY_IPC__ na janela (no pnpm dev, por exemplo, não põe).

declare global {
  interface Window {
    __SENTRY_IPC__?: unknown
  }
}

if (window.__SENTRY_IPC__) {
  init({
    // Sem cabeçalhos de rastreamento nas requisições da janela.
    tracePropagationTargets: [],
    integrations: (defaults) => [
      // Sem as sessões (o processo principal também não manda) e sem os cliques: o registro de um
      // clique guarda textos da tela, como o título de uma conversa.
      ...defaults.filter((i) => i.name !== 'BrowserSession' && i.name !== 'Breadcrumbs'),
      breadcrumbsIntegration({ dom: false }),
      // Janela parada por 5 s (um laço sem fim, por exemplo): o processo principal pega onde ela estava.
      eventLoopBlockIntegration({ threshold: 5000 })
    ]
  })
}
