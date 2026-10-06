// Formato compartilhado entre o processo principal e a interface.
export type UsageWindow = {
  percent: number
  resetsAt: string
}

export type Usage = {
  session: UsageWindow | null
  weekly: UsageWindow | null
  updatedAt: number
}
