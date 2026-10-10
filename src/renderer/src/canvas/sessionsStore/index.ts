import { useEffect } from 'react'
import type { UncommittedFile } from '../../../../shared/sessions'
import { shallowEqual } from '../../lib/shallowEqual'
import { useStore } from '../../lib/useStore'
import type { ConversationSummary } from '../types'
import { watch, watchChanges } from './observers'
import { EVERYTHING, needFor, request, requestChangesSoon } from './reads'
import { changesAt, store, watching, watchingChanges } from './state'
// Efeito de importar: as não vistas vão para o ícone da barra de menus.
import './unreadSync'

export { DESIGN_PREFIX } from './convert'
export { setPoppedOut, useIsUnread, useViewing } from './unread'

// Conversas de cada pasta, lidas dos arquivos do Claude Code, a branch atual dela e os arquivos
// não comitados. Não entram no canvas salvo nem no desfazer: são sempre relidas do disco.
// Mudanças chegam na hora pelo aviso do processo principal (sessions:changed), que diz o motivo:
// a conversa relê a lista (e o git status, com limite de tempo: o Claude pode ter editado
// arquivos); o .git, a branch e o git status. A conferência periódica é só a rede de segurança
// para algum aviso perdido.
const REFRESH_MS = 10_000
// O git status é o mais caro (um processo git por pasta). Na conferência e no foco ele só roda
// na pasta lida há mais de um minuto, e em poucas pastas por vez (as mais antigas primeiro);
// no aviso do .git da pasta e no refreshNow, roda na hora; no aviso da conversa, com limite.
const CHANGES_MS = 60_000
const GIT_PER_ROUND = 8
const EMPTY: ConversationSummary[] = []

// Conferência periódica e ao voltar para a janela: conversas e branch de toda pasta na tela; o
// git status só onde está vencido, no máximo GIT_PER_ROUND pastas por vez.
function refreshAll(): void {
  const now = Date.now()
  const due = new Set(
    [...watchingChanges.keys()]
      .filter((path) => now - (changesAt.get(path) ?? 0) >= CHANGES_MS)
      .sort((a, b) => (changesAt.get(a) ?? 0) - (changesAt.get(b) ?? 0))
      .slice(0, GIT_PER_ROUND)
  )
  for (const path of watching.keys()) request(path, { list: true, branch: true, changes: due.has(path) })
}
setInterval(refreshAll, REFRESH_MS)
window.addEventListener('focus', refreshAll)
window.api.sessions.onChanged((path, change) => {
  if (!watching.has(path)) return
  request(path, needFor(change))
  if (change === 'transcript') requestChangesSoon(path)
})

export function getSessions(path: string): ConversationSummary[] {
  return store.get().sessions.get(path) ?? EMPTY
}

// Conversas de uma pasta; mantém a lista atualizada enquanto o componente estiver na tela.
export function useSessions(path: string): ConversationSummary[] {
  useEffect(() => watch(path), [path])
  return useStore(store, (s) => s.sessions.get(path) ?? EMPTY)
}

// Conversas de várias pastas (o resumo do grupo recolhido, cujas pastas não estão na tela):
// observa todas enquanto o componente estiver na tela e redesenha só quando alguma lista muda.
export function useSessionsOf(paths: readonly string[]): ConversationSummary[][] {
  // Caminho não tem \0: a lista vira uma chave estável entre renders.
  const key = paths.join('\0')
  useEffect(() => {
    const stops = (key ? key.split('\0') : []).map((path) => watch(path))
    return () => stops.forEach((stop) => stop())
  }, [key])
  return useStore(store, (s) => paths.map((path) => s.sessions.get(path) ?? EMPTY), shallowEqual)
}

// Branch atual da pasta; nulo fora de repositório ou antes da primeira leitura.
export function useBranch(path: string): string | null {
  useEffect(() => watch(path), [path])
  return useStore(store, (s) => s.branch.get(path) ?? null)
}

// Arquivos não comitados do repositório da pasta; nulo fora de repositório ou antes da
// primeira leitura.
export function useUncommitted(path: string): UncommittedFile[] | null {
  useEffect(() => watchChanges(path), [path])
  return useStore(store, (s) => s.changes.get(path) ?? null)
}

// Relê tudo na hora, sem esperar o aviso do .git ou a conferência periódica: criar ou salvar um
// arquivo não mexe no .git, e a árvore de código quer a cor certa logo.
export function refreshNow(path: string): void {
  if (watching.has(path)) request(path, EVERYTHING)
}
