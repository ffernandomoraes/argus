import { arr, contentOf, obj, type Line } from '../transcripts/line'

type Range = { start: number; end: number }

// Onde ficam, no arquivo, as mensagens com imagem: a miniatura lê só aquela linha, em vez de
// reler a conversa inteira a cada preview.
export class ImageIndex {
  private at = new Map<string, Range>()

  add(line: Line, start: number, end: number): void {
    const id = line.uuid
    if (typeof id !== 'string' || this.at.has(id)) return
    if (arr(imageSource(line))?.some((c) => obj(c)?.type === 'image')) this.at.set(id, { start, end })
  }

  find(id: string): Range | undefined {
    return this.at.get(id)
  }
}

// Imagens de uma linha, prontas para o <img>.
export function imagesOf(line: Line): string[] {
  return (arr(imageSource(line)) ?? []).flatMap((item) => {
    const c = obj(item)
    const source = obj(c?.source)
    if (c?.type !== 'image' || source?.type !== 'base64' || typeof source.data !== 'string') return []
    return [`data:${source.media_type};base64,${source.data}`]
  })
}

// Onde estão as imagens da linha: na mensagem comum, ou no anexo "queued_command" da mensagem
// enviada no meio de uma resposta (o print vai junto do texto em prompt).
function imageSource(line: Line): unknown {
  const attachment = obj(line.attachment)
  return attachment?.type === 'queued_command' ? attachment.prompt : contentOf(line)
}
