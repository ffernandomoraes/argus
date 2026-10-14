// Reportar problema: o Claude da própria pessoa investiga a configuração do Argus nesta máquina, só
// lendo, e o app monta um relatório para ela copiar e mandar (ver src/main/report/).

// O que a pessoa conta e, quando o pedido sai de um erro na tela, onde ele apareceu.
export type ReportProblem = {
  description: string
  error?: string
  // Onde o erro apareceu: 'conversa', 'terminal'...
  where?: string
  // Pasta do projeto (decide se roda no Windows ou no WSL) e conta do grupo.
  cwd?: string
  account?: string
  sessionId?: string
}

export type ReportState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number; steps: string[] }
  // analyzed: false quando o Claude não chegou a investigar (sem login, parado, erro); o relatório
  // vai só com os dados que o app juntou, e `note` diz por quê.
  | { status: 'done'; text: string; analyzed: boolean; note?: string }
