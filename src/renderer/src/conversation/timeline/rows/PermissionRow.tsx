import { memo } from 'react'
import type { PermissionAnswer, PermissionRequest } from '../../../../../shared/chat'
import { PermissionCard } from '../../PermissionCard'

type Props = { request: PermissionRequest; onAnswer: (id: string, answer: PermissionAnswer) => void }

// Pedido de permissão (ou pergunta) na linha do tempo. O pedido não muda depois de criado, mas
// chega como objeto novo a cada estado do chat: compara pelo id, para o cartão (com o diff) não
// redesenhar enquanto o resto da conversa anda.
export const PermissionRow = memo(
  function PermissionRow({ request, onAnswer }: Props) {
    return <PermissionCard request={request} onAnswer={(answer) => onAnswer(request.id, answer)} />
  },
  (a: Props, b: Props) => a.request.id === b.request.id && a.onAnswer === b.onAnswer
)
