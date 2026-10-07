import { useEffect, useSyncExternalStore } from 'react'
import type { ClaudeInfo, ClaudeModel } from '../../../shared/models'
import { resolveAccount, useAuth, useConversationAccount } from '../auth/useAuth'

// O que o `claude` de cada conta informa ao iniciar; chega alguns segundos depois do app abrir.
// Contas de planos diferentes podem ter modelos diferentes.
const infos = new Map<string, ClaudeInfo>()
const asked = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function store(account: string, info: ClaudeInfo): void {
  infos.set(account, info)
  version++
  listeners.forEach((l) => l())
}

window.api.claude.onInfo(store)

function ask(account: string): void {
  if (infos.has(account) || asked.has(account)) return
  asked.add(account)
  // Sem resposta ainda (o monitor dela está subindo): o aviso onInfo traz depois.
  window.api.claude.info(account).then((i) => i && !infos.has(account) && store(account, i))
}

// Sem conta, a da conversa na tela (AccountContext) ou, fora dela, a padrão.
export function useClaudeInfo(account?: string): ClaudeInfo | null {
  const auth = useAuth()
  const conversation = useConversationAccount()
  const id = resolveAccount(auth, account ?? conversation)
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version
  )
  useEffect(() => ask(id), [id])
  return infos.get(id) ?? null
}

export function useModels(): ClaudeModel[] {
  return useClaudeInfo()?.models ?? []
}
