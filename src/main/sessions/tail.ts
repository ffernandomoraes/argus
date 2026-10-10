import { num, obj, parseLine, type Line } from '../transcripts/line'
import { readSlice } from '../transcripts/read'
import { userText } from './prompt'

// Título e uso de contexto são regravados ao longo da conversa: basta ler o fim.
export const TAIL_BYTES = 512 * 1024

export type Usage = { tokens: number; model: string }

export type Tail = {
  // Da última linha de cada tipo; só vale texto não vazio (título vazio sumia com a conversa).
  customTitle?: string
  aiTitle?: string
  usage?: Usage
  // Primeira mensagem da pessoa no trecho: só procurada quando o começo do arquivo não tinha.
  firstPrompt?: string
}

// Tudo que entrou na última resposta = o que a conversa ocupa da janela agora.
function usageOf(l: Line): Usage | undefined {
  const message = l.type === 'assistant' && !l.isSidechain ? obj(l.message) : undefined
  const usage = obj(message?.usage)
  const model = message?.model
  // "<synthetic>": aviso do próprio Claude Code (erro, interrupção), sem uso real.
  if (!usage || typeof model !== 'string' || model === '<synthetic>') return undefined
  const tokens =
    (num(usage.input_tokens) ?? 0) + (num(usage.cache_creation_input_tokens) ?? 0) + (num(usage.cache_read_input_tokens) ?? 0)
  return tokens === 0 ? undefined : { tokens, model }
}

const title = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined)

export async function readTail(file: string, size: number, wantPrompt: boolean): Promise<Tail> {
  const text = await readSlice(file, Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES))
  const lines = text.split('\n')
  const tail: Tail = {}
  let custom = false
  let ai = false
  // De trás para frente, montando só as linhas que podem ter o que falta (o texto é conferido
  // antes): parsear os 512 KB inteiros de cada conversa pesava com centenas delas.
  for (let i = lines.length - 1; i >= 0 && !(custom && ai && tail.usage); i--) {
    const raw = lines[i]
    const wantCustom = !custom && raw.includes('"custom-title"')
    const wantAi = !ai && raw.includes('"ai-title"')
    const wantUsage = !tail.usage && raw.includes('"usage"')
    if (!wantCustom && !wantAi && !wantUsage) continue
    const l = parseLine(raw)
    if (!l) continue
    if (wantCustom && l.type === 'custom-title') {
      custom = true
      tail.customTitle = title(l.customTitle)
    }
    if (wantAi && l.type === 'ai-title') {
      ai = true
      tail.aiTitle = title(l.aiTitle)
    }
    if (wantUsage) tail.usage = usageOf(l)
  }
  if (wantPrompt) {
    for (const raw of lines) {
      if (!raw.includes('"user"')) continue
      const l = parseLine(raw)
      const prompt = l && userText(l)
      if (prompt) {
        tail.firstPrompt = prompt
        break
      }
    }
  }
  return tail
}
