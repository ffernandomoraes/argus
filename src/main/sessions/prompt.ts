import { arr, contentOf, obj, type Line } from '../transcripts/line'

// Primeiro texto que a pessoa escreveu na linha. Comandos e avisos internos (<command-name>,
// <local-command-...>) não servem de título. Em lista, o aviso oculto pode vir antes do texto (o do
// worktree antes de um texto que começa com /, ver chats/messages.ts): vale a primeira parte que não é aviso.
export function userText(line: Line): string | null {
  if (line.type !== 'user' || line.isSidechain || line.isMeta) return null
  const content = contentOf(line)
  const texts = typeof content === 'string' ? [content] : (arr(content) ?? []).map((c) => (obj(c)?.type === 'text' ? obj(c)?.text : undefined))
  for (const text of texts) {
    const clean = typeof text === 'string' ? text.trim() : ''
    if (clean && !clean.startsWith('<')) return clean
  }
  return null
}

// Mensagem de verdade: texto ou print da pessoa, ou resposta do Claude. Conversa aberta e fechada
// sem nada disso não entra na lista.
export function isMessage(line: Line): boolean {
  if (line.isSidechain || line.isMeta) return false
  if (line.type === 'assistant') {
    const model = obj(line.message)?.model
    return typeof model === 'string' && model !== '<synthetic>'
  }
  if (line.type !== 'user') return false
  return userText(line) !== null || !!arr(contentOf(line))?.some((c) => obj(c)?.type === 'image')
}
