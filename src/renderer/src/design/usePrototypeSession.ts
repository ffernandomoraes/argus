import { useEffect, useEffectEvent } from 'react'
import type { Design } from '../../../shared/design'
import { moveConversationSettings, setConversationSettings, useConversationSettings } from '../conversation/conversationSettings'
import type { SessionSettings } from '../conversation/SessionSettings'
import { useChat } from '../conversation/useChat'
import { useConversationHistory } from '../conversation/useConversationHistory'
import { nameIn, routeIn } from './prototype/appLines'
import { chatKeyOf, draftKeyOf } from './prototype/conversation'

// A conversa do Claude Code que escreve o protótipo: o estado ao vivo, o histórico e o que ela
// informa ao design (sessão, endereço e nome da tela, nas linhas ROTA e TELA).
export function usePrototypeSession(design: Design, onUpdate: (patch: Partial<Design>) => void) {
  const { projectPath, route, sessionId } = design
  const key = chatKeyOf(design)
  const live = useChat(key)
  const running = live?.status === 'running' || live?.status === 'needs-you'

  // A conversa fica de pé enquanto a tela está aberta aqui, como no chat.
  useEffect(() => {
    window.api.chat.retain(key)
    return () => window.api.chat.release(key)
  }, [key])

  const update = useEffectEvent((patch: Partial<Design>) => onUpdate(patch))
  const latest = useEffectEvent(() => design)

  // Sessão nova: o id vai para a tela, para retomar a conversa depois, e o modelo e o esforço
  // escolhidos antes dela vão junto.
  const liveSession = live?.sessionId
  useEffect(() => {
    const d = latest()
    if (!liveSession || liveSession === d.sessionId) return
    moveConversationSettings(draftKeyOf(d), liveSession)
    update({ sessionId: liveSession })
  }, [liveSession])

  // O endereço e o nome chegam no texto da resposta (linhas ROTA e TELA).
  const partial = live?.partial
  useEffect(() => {
    if (!partial) return
    const d = latest()
    const nextRoute = routeIn(partial)
    const name = nameIn(partial)
    if ((nextRoute && nextRoute !== d.route) || (name && name !== d.name)) update({ ...(nextRoute && { route: nextRoute }), ...(name && { name }) })
  }, [partial])

  // Drawer fechado no meio do pedido: as linhas ROTA e TELA ficaram só na conversa. Ao reabrir sem
  // endereço, procura nela (a resposta mais recente vale).
  useEffect(() => {
    if (!sessionId || route || running) return
    let alive = true
    window.api.sessions.history(projectPath, sessionId).then(
      (messages) => {
        const text = messages
          .filter((m) => m.role === 'assistant')
          .map((m) => m.text)
          .join('\n')
        const found = routeIn(text)
        const name = nameIn(text)
        if (alive && (found || name)) update({ ...(found && { route: found }), ...(name && { name }) })
      },
      (err: unknown) => console.error('[design] histórico do protótipo:', err)
    )
    return () => {
      alive = false
    }
  }, [sessionId, route, running, projectPath])

  // Modelo e esforço: a pessoa escolhe, como na conversa; a troca vale também na conversa já aberta.
  const settings = useConversationSettings(key)
  const changeSettings = (patch: Partial<SessionSettings>) => {
    setConversationSettings(key, patch)
    window.api.chat.configure(key, patch)
  }

  // Relê quando a conversa grava algo (revision). Sem o updatedAt do design, que muda a cada
  // navegação na página: cada clique relia o histórico inteiro.
  const history = useConversationHistory(projectPath, sessionId, '', live?.revision)

  return { key, live, running, settings, changeSettings, history }
}
