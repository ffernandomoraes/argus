import { createContext } from 'react'
import type { ReportProblem } from '../../../shared/report'
import { createStore } from '../lib/createStore'

// Pedido de abrir o "Reportar problema": de onde veio (erro na tela, pasta, conta). A descrição a
// pessoa escreve no modal.
export type ReportRequest = Omit<ReportProblem, 'description'>

// O modal é um só por janela (ver ReportHost), aberto de qualquer lugar: barra de título, erro da
// conversa, erro do terminal.
export const reportStore = createStore<{ open: boolean; request: ReportRequest }>({ open: false, request: {} })

export function openReport(request: ReportRequest = {}): void {
  reportStore.set({ open: true, request })
}

export function closeReport(): void {
  reportStore.set((s) => ({ ...s, open: false }))
}

// Pasta, conta e conversa de quem mostra o erro: o botão Investigar lá dentro (a lista do chat não
// conhece nada disso) leva junto.
export const ReportContext = createContext<ReportRequest>({})
