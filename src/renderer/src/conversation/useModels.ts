import { useEffect } from 'react'
import type { ClaudeInfo, ClaudeModel } from '../../../shared/models'
import { parseAgentRef } from '../../../shared/providers'
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
      // Outro agente sem resposta: o CLI não listou (não instalado, sem login). Não vem aviso depois.
      else if (!i && parseAgentRef(account)) unavailable.set((s) => new Set(s).add(account))
    },
    () => asked.delete(account)
  )
}

// Contas de outros agentes cujos modelos não vieram: param de "carregando".
const unavailable = createStore<ReadonlySet<string>>(new Set())

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

// Os modelos da conta ainda estão chegando (o CLI do agente leva alguns segundos para listar).
export function useModelsLoading(account?: string): boolean {
  const auth = useAuth()
  const conversation = useConversationAccount()
  const id = resolveAccount(auth, account ?? conversation)
  const info = useClaudeInfo(account)
  return useStore(unavailable, (s) => !info && !s.has(id))
}

export function useModels(): ClaudeModel[] {
  return useClaudeInfo()?.models ?? NO_MODELS
}
