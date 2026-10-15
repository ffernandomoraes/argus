import type { Head } from './head'
import type { Tail, Usage } from './tail'

// O que fica guardado de cada conversa. A porcentagem de contexto e o status saem na hora de
// listar: mudam sem o arquivo mudar.
export type SummaryData = { id: string; title: string; updatedAt: string; repliedAt: string; usage?: Usage; design: boolean }

// Título: o renomeado (/rename), senão o gerado pelo Claude, senão a primeira mensagem.
// Conversa com mensagens mas sem texto para título (só prints, por exemplo) também aparece, com
// título vazio: o "sem título" sai na hora de listar, no idioma da interface (este resumo fica guardado).
export function summarize(id: string, mtime: Date, head: Head, tail: Tail): SummaryData | null {
  const title =
    tail.customTitle ??
    tail.aiTitle ??
    head.firstPrompt ??
    tail.firstPrompt ??
    (head.hasMessages || tail.usage ? '' : null)
  // Sessão sem nenhuma mensagem (aberta e fechada) não entra na lista.
  if (title === null) return null
  const updatedAt = mtime.toISOString()
  // Sem resposta no fim do arquivo (conversa nova, ou só ferramentas no trecho lido): a gravação.
  const repliedAt = tail.repliedAt ?? updatedAt
  return { id, title: title.split('\n')[0].slice(0, 120), updatedAt, repliedAt, usage: tail.usage, design: head.design }
}
