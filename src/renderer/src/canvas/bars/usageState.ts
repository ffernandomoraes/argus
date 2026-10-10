import type { Usage } from '../../../../shared/usage'

export type Usages = Record<string, Usage>

// Aviso de uma conta: o uso novo, ou nulo quando a conta saiu ou foi removida.
export function applyUsage(current: Usages, account: string, usage: Usage | null): Usages {
  const next = { ...current }
  if (usage) next[account] = usage
  else delete next[account]
  return next
}

// Resposta do pedido inicial: só entra o que nenhum aviso já trouxe. A resposta pode chegar
// depois de um aviso mais novo (inclusive o de uma conta que saiu) e não pode desfazê-lo.
export function mergeLoaded(current: Usages, loaded: Usages, heard: ReadonlySet<string>): Usages {
  const next = { ...current }
  for (const [account, usage] of Object.entries(loaded)) if (!heard.has(account)) next[account] = usage
  return next
}
