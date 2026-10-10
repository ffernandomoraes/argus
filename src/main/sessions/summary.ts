import type { Head } from './head'
import type { Tail, Usage } from './tail'

// O que fica guardado de cada conversa. A porcentagem de contexto e o status saem na hora de
// listar: mudam sem o arquivo mudar.
export type SummaryData = { id: string; title: string; updatedAt: string; usage?: Usage; design: boolean }

// Conversa com mensagens mas sem texto para título (só prints, por exemplo) também aparece.
const UNTITLED = 'Conversa sem título'

// Título: o renomeado (/rename), senão o gerado pelo Claude, senão a primeira mensagem.
export function summarize(id: string, mtime: Date, head: Head, tail: Tail): SummaryData | null {
  const title =
    tail.customTitle ??
    tail.aiTitle ??
    head.firstPrompt ??
    tail.firstPrompt ??
    (head.hasMessages || tail.usage ? UNTITLED : null)
  // Sessão sem nenhuma mensagem (aberta e fechada) não entra na lista.
  if (!title) return null
  return { id, title: title.split('\n')[0].slice(0, 120), updatedAt: mtime.toISOString(), usage: tail.usage, design: head.design }
}
