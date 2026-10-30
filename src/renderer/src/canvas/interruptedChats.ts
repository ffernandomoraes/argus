import type { InterruptedChat } from '../../../shared/chat'
import { createStore, type ReadableStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'
import { canvasScope, inScope } from './canvasScope'
import { displayPath } from './factory'

// Conversas que o Argus fechou no meio (atualização, ⌘Q, queda): bolinha vermelha na lista e o aviso
// com "Continuar de onde parou" na conversa, até você continuar, mandar outra mensagem ou dispensar.
// Quem guarda é o processo principal (main/app/interruptedChats.ts); a lista vem dele quando muda.
const interrupted = createStore<InterruptedChat[]>([])

let received = false
window.api.chat.onInterrupted((list) => {
  received = true
  interrupted.set(list)
})
void window.api.chat.interrupted().then((list) => {
  // O aviso chegou antes da resposta: ele é mais novo.
  if (!received) interrupted.set(list)
})

export const interruptedChats: ReadableStore<InterruptedChat[]> = interrupted

export function useInterruptedChats(): InterruptedChat[] {
  return useStore(interrupted)
}

export function useIsInterrupted(sessionId: string | undefined): boolean {
  return useStore(interrupted, (list) => !!sessionId && list.some((c) => c.sessionId === sessionId))
}

export function dismissInterrupted(sessionId: string): void {
  window.api.chat.dismissInterrupted(sessionId)
}

// Só as das pastas (e conversas soltas) que estão no canvas desta janela, como as ativas.
export function useInterruptedInCanvas(): InterruptedChat[] {
  const list = useStore(interrupted)
  const s = useStore(canvasScope)
  if (!s) return list
  const shown = list.filter((c) => inScope(s, displayPath(c.cwd), c.sessionId))
  return shown.length === list.length ? list : shown
}
