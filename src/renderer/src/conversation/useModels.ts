import { useEffect } from 'react'
import type { ClaudeInfo, ClaudeModel } from '../../../shared/models'
import { resolveAccount, useAuth, useConversationAccount } from '../auth/useAuth'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// O que o `claude` de cada conta informa ao iniciar; chega alguns segundos depois do app abrir.
// Contas de planos diferentes podem ter modelos diferentes.
const infos = createStore<ReadonlyMap<string, ClaudeInfo>>(new Map())
const asked = new Set<string>()

function store(account: string, info: ClaudeInfo): void {
  infos.set((m) => new Map(m).set(account, info))
}

window.api.claude.onInfo(store)

function ask(account: string): void {
  if (infos.get().has(account) || asked.has(account)) return
  asked.add(account)
  // Sem resposta ainda (o monitor dela está subindo): o aviso onInfo traz depois. Falhou: pergunta
  // de novo na próxima vez que alguém precisar.
  window.api.claude.info(account).then(
    (i) => {
      if (i && !infos.get().has(account)) store(account, i)
    },
    () => asked.delete(account)
  )
}

const NO_MODELS: ClaudeModel[] = []

// Sem conta, a da conversa na tela (AccountContext) ou, fora dela, a padrão. Redesenha só quando
// muda o que a conta pedida informa.
export function useClaudeInfo(account?: string): ClaudeInfo | null {
  const auth = useAuth()
  const conversation = useConversationAccount()
  const id = resolveAccount(auth, account ?? conversation)
  useEffect(() => ask(id), [id])
  return useStore(infos, (m) => m.get(id) ?? null)
}

export function useModels(): ClaudeModel[] {
  return useClaudeInfo()?.models ?? NO_MODELS
}
