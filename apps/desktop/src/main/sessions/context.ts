import { contextWindowFor } from '../contextWindows'
import type { Usage } from './tail'

// Quanto da janela de contexto a conversa ocupa, de 0 a 100. Calculado na hora de mostrar: a
// janela real de cada modelo é aprendida ao usar o chat (contextWindows.ts) e muda o resultado.
export function percentOf(usage: Usage | undefined): number {
  return usage ? Math.min(100, Math.round((usage.tokens / contextWindowFor(usage.model)) * 100)) : 0
}
