import { useEffect, useState } from 'react'
import type { ChatState } from '../../../shared/chat'

// Estado da sessão do Claude ligada a esta conversa pelo chat; nulo se o chat não a abriu.
export function useChat(key: string): ChatState | null {
  const [state, setState] = useState<{ key: string; value: ChatState | null } | null>(null)

  useEffect(() => {
    let alive = true
    const off = window.api.chat.onState((k, value) => {
      if (k === key) setState({ key, value })
    })
    window.api.chat.state(key).then((value) => {
      // Um evento que chegou antes da resposta é mais novo: prevalece.
      if (alive) setState((cur) => (cur?.key === key ? cur : { key, value }))
    })
    return () => {
      alive = false
      off()
    }
  }, [key])

  return state?.key === key ? state.value : null
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const isSendableImage = (file: File) => IMAGE_TYPES.includes(file.type)

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
