import { memo } from 'react'
import { PlanCard } from '../../PlanCard'
import type { Message } from '../../types'

// Plano do modo plano já respondido: o cartão com o plano formatado. A resposta do Claude Code
// (onde o arquivo do plano ficou salvo) não aparece.
export const PlanRow = memo(function PlanRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  return <PlanCard plan={message.detail ?? ''} error={message.error} />
})
