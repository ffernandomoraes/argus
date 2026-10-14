// Formato compartilhado entre o processo principal e a interface.
export type UsageWindow = {
  percent: number
  // Nulo enquanto a janela não começou: conta sem mensagem nela ainda.
  resetsAt: string | null
  // Duração da janela em minutos, quando o agente informa (Codex: 300 = 5 horas, 10080 = semana,
  // 43200 = 30 dias no plano free). O Claude não manda: as janelas dele têm rótulo fixo.
  minutes?: number
}

// A chave de cada uso é a conta: a do Claude ("main", 8 letras) ou a de outro agente ("codex:main").
// No Codex, `session` é a janela mais curta e `weekly` a mais longa, com a duração em `minutes`.
export type Usage = {
  session: UsageWindow | null
  weekly: UsageWindow | null
  // Semanal de um modelo só (ex.: Fable), além do semanal de todos. No Codex, os limites à parte de
  // um modelo, com a duração de cada janela.
  models: { name: string; window: UsageWindow }[]
  updatedAt: number
}
