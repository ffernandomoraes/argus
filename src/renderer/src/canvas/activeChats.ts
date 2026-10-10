import type { ActiveChat } from '../../../shared/chat'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Conversas do app trabalhando ou esperando você, em todas as pastas. O processo principal manda a
// lista quando ela muda; a primeira leitura cobre a janela aberta com conversas já rodando.
const active = createStore<ActiveChat[]>([])

let received = false
window.api.chat.onActive((chats) => {
  received = true
  active.set(chats)
})
void window.api.chat.active().then((chats) => {
  // O aviso chegou antes da resposta: ele é mais novo.
  if (!received) active.set(chats)
})

export function useActiveChats(): ActiveChat[] {
  return useStore(active)
}
