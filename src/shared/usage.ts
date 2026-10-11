// Formato compartilhado entre o processo principal e a interface.
export type UsageWindow = {
  percent: number
  // Nulo enquanto a janela não começou: conta sem mensagem nela ainda.
  resetsAt: string | null
}

export type Usage = {
  session: UsageWindow | null
  weekly: UsageWindow | null
  updatedAt: number
}
