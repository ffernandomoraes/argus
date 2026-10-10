import { useEffect } from 'react'
import type { ChatState } from '../../../../shared/chat'
import { useChat } from '../useChat'

// Estado do chat da conversa na tela. Enquanto ela está na tela a sessão fica de pé; ao fechar,
// ela é encerrada (o processo principal espera um pouco e não derruba um pedido no meio).
export function useLiveChat(key: string): ChatState | null {
  useEffect(() => {
    window.api.chat.retain(key)
    return () => window.api.chat.release(key)
  }, [key])
  return useChat(key)
}
