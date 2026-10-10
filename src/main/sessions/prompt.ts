import { arr, contentOf, obj, type Line } from '../transcripts/line'

// Primeiro texto que a pessoa escreveu na linha. Comandos e avisos internos (<command-name>,
// <local-command-...>) não servem de título.
export function userText(line: Line): string | null {
  if (line.type !== 'user' || line.isSidechain || line.isMeta) return null
  const content = contentOf(line)
  const text = typeof content === 'string' ? content : obj(arr(content)?.find((c) => obj(c)?.type === 'text'))?.text
  if (typeof text !== 'string') return null
  const clean = text.trim()
  return clean && !clean.startsWith('<') ? clean : null
}

// Protótipo do modo design: o primeiro pedido leva as instruções num bloco <modo-design>.
export function isDesign(line: Line): boolean {
  const content = line.type === 'user' && !line.isSidechain ? contentOf(line) : null
  return !!arr(content)?.some((item) => {
    const c = obj(item)
    return c?.type === 'text' && String(c.text).trimStart().startsWith('<modo-design>')
  })
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
