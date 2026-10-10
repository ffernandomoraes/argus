import { createContext } from 'react'
import { createStore, type Store } from '../lib/createStore'
import type { ActiveConversation, ActiveDesign } from './CanvasContext'

// O que os blocos mostram e muda com o uso do canvas (quem está sendo renomeado, o grupo que recebe
// o bloco arrastado, a conversa aberta...). Fica num store, fora do contexto dos comandos: cada bloco
// lê só o pedaço dele (useCanvasView.ts) e redesenha só quando esse pedaço muda. No contexto, abrir
// uma conversa ou passar um bloco sobre um grupo redesenhava todos os nós.
export type CanvasView = {
  renamingId: string | null
  // Grupo destacado: recebe o bloco solto que está sendo arrastado, se ele for largado agora.
  dropTargetId: string | null
  // Conversa e design abertos nos drawers (espelho do estado dos drawers, no Canvas).
  activeConversation: ActiveConversation | null
  activeDesign: ActiveDesign | null
  // Conversas abertas em janela separada.
  poppedOut: ReadonlySet<string>
  // Bloco que acabou de ser criado pela pessoa (terminal, conversa no canvas): só ele pega o foco
  // ao aparecer. Abrir o app, expandir um grupo ou desfazer monta blocos que não são novos.
  newBlockId: string | null
}

export type CanvasViewStore = Store<CanvasView>

export function createCanvasView(): CanvasViewStore {
  return createStore<CanvasView>({
    renamingId: null,
    dropTargetId: null,
    activeConversation: null,
    activeDesign: null,
    poppedOut: new Set(),
    newBlockId: null
  })
}

// Muda só os campos que vieram diferentes; sem diferença, ninguém é avisado.
export function patchView(view: CanvasViewStore, patch: Partial<CanvasView>): void {
  view.set((s) => {
    const keys = Object.keys(patch) as (keyof CanvasView)[]
    return keys.every((k) => Object.is(s[k], patch[k])) ? s : { ...s, ...patch }
  })
}

// Um store por Canvas (criado nele), com identidade fixa: o contexto nunca muda de valor.
export const CanvasViewContext = createContext<CanvasViewStore | null>(null)
