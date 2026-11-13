type Identity = { id: string; sessionId?: string }

// A mesma conversa com outro id: a nova ("new-…") passa a ser listada pelo id da sessão quando o
// Claude a grava. Para a tela é a mesma conversa (não recria o chat, não anima como outra).
export function sameConversation(a: Identity, b: Identity): boolean {
  return a.id === b.id || (!!a.sessionId && (a.sessionId === b.id || a.sessionId === b.sessionId))
}
