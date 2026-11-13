import { MAIN_ACCOUNT, sameLogin, type Account } from '@argus/shared/auth'

// Contas do app com o mesmo login do Claude. Lógica pura, sem rodar nada.
// Acontecia de dois jeitos (2026-11-13): adicionar uma conta com a principal sem login (a conferência
// de conta repetida só olhava as logadas) e entrar de novo numa conta com o claude.ai que estava
// aberto no navegador, que era o de outra conta do app. As duas apareciam na barra de uso com os
// mesmos números.

type Listed = { id: string; status: Account | null | undefined }

export type Twin = { keep: string; remove: string }

// Quem fica e quem sai, para cada conta repetida. `accounts` na ordem da lista (a principal primeiro).
// - A principal sempre fica: é a do terminal e do VS Code, e não tem como sair da lista.
// - Entre duas extras, sai a que acabou de entrar (justLoggedIn): ela estava sem login, então nada
//   rodava com ela; a outra pode estar no meio de uma resposta.
// - Sem saber quem acabou de entrar (conferência de rotina), fica a mais antiga na lista.
export function findTwins(accounts: Listed[], justLoggedIn?: string): Twin[] {
  const twins: Twin[] = []
  const done = new Set<string>()
  for (const first of accounts) {
    if (done.has(first.id)) continue
    const group = accounts.filter((a) => a.id === first.id || (!done.has(a.id) && sameLogin(first.status, a.status)))
    group.forEach((a) => done.add(a.id))
    if (group.length < 2) continue
    const keep = group.find((a) => a.id === MAIN_ACCOUNT) ?? group.find((a) => a.id !== justLoggedIn) ?? group[0]
    for (const a of group) if (a.id !== keep.id) twins.push({ keep: keep.id, remove: a.id })
  }
  return twins
}
