import { createContext, useContext, type MouseEvent } from 'react'
import { SquareTerminal } from 'lucide-react'
import { backgroundTaskOf } from '../../../shared/backgroundTasks'
import type { TaskRef } from '../canvas/CanvasContext'
import type { Message } from './types'
import { tr } from '../i18n'

// Abre a saída de uma tarefa em segundo plano da conversa. Nulo onde não há drawer para mostrar (a
// janela separada): a linha do comando fica sem o botão.
export const TaskOpenContext = createContext<((task: TaskRef) => void) | null>(null)

// "Ver saída" na linha de um comando (ou monitor) que o Claude deixou em segundo plano. Fica dentro
// da linha: o clique não abre nem fecha os detalhes dela.
export function TaskOutputButton({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const openTask = useContext(TaskOpenContext)
  const task = openTask ? backgroundTaskOf(message.result) : null
  if (!openTask || !task) return null
  const open = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openTask({ id: task.id, description: message.input, command: message.detail, outputFile: task.outputFile })
  }
  return (
    <button
      type="button"
      onClick={open}
      title={tr('Ver a saída do comando em segundo plano', 'See the background command’s output')}
      className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-faint hover:bg-line hover:text-text"
    >
      <SquareTerminal size={12} />
      {tr('Ver saída', 'View output')}
    </button>
  )
}
