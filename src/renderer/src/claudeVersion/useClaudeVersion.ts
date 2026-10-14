import type { ClaudeVersionState } from '../../../shared/claudeVersion'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Qual `claude` o app usa e se há versão nova, acompanhando o processo principal. Um só para a
// janela: o menu de modelos e as Configurações leem o mesmo.
const store = createStore<ClaudeVersionState | null>(null)

window.api.claudeVersion.onState((state) => store.set(state))
// O aviso que chegar antes da resposta vale mais: é mais novo.
void window.api.claudeVersion.get().then((state) => {
  if (!store.get()) store.set(state)
})

export function useClaudeVersion(): ClaudeVersionState | null {
  return useStore(store)
}
