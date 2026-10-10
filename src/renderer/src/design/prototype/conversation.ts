import type { ChatImage } from '../../../../shared/chat'
import type { Design } from '../../../../shared/design'
import { freezeConversationSettings, getConversationSettings } from '../../conversation/conversationSettings'

// Protótipo: a tela no código do projeto, escrita por uma conversa do Claude Code na pasta. É uma
// conversa como as outras (aparece na lista da pasta e abre no chat); o drawer mostra a página.

// Conversa do protótipo: pela sessão, quando já tem; antes disso, por uma chave fixa do design.
export const draftKeyOf = (design: Design) => `design-${design.id}`
export const chatKeyOf = (design: Design) => design.sessionId ?? draftKeyOf(design)

export function sendPrototype(opts: { design: Design; cwd: string; account?: string; text: string; images: ChatImage[]; hint: string }): void {
  const key = chatKeyOf(opts.design)
  const settings = getConversationSettings(key)
  // Como na conversa: o que valia no envio fica guardado nela.
  freezeConversationSettings(key, settings)
  window.api.chat.send({
    key,
    cwd: opts.cwd,
    account: opts.account,
    sessionId: opts.design.sessionId,
    settings,
    text: opts.text,
    images: opts.images,
    hint: opts.hint
  })
}
