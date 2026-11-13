import { memo } from 'react'
import { MarkdownFileCard, PlanCard } from '../../PlanCard'
import type { Message } from '../../types'

type ToolMessage = Extract<Message, { role: 'tool' }>

// Plano do modo plano já respondido: o cartão com o plano formatado. A resposta do Claude Code
// (onde o arquivo do plano ficou salvo) não aparece.
export const PlanRow = memo(function PlanRow({ message }: { message: ToolMessage }) {
  return <PlanCard plan={message.detail ?? ''} error={message.error} />
})

// Arquivo .md criado pelo Claude: formatado como o plano, com o caminho dele.
export const MarkdownFileRow = memo(function MarkdownFileRow({ message }: { message: ToolMessage }) {
  return (
    <MarkdownFileCard
      text={message.document ?? ''}
      title={`${message.label} - ${message.input}`}
      path={message.detail ?? message.input}
      error={message.error}
    />
  )
})
