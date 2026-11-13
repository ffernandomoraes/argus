// Arquivo anexado que não é imagem: vai para o agente pelo caminho no disco, num bloco à parte do
// texto (<argus-files>). O balão mostra o cartão do arquivo, como antes de enviar, e não o caminho.
export type AttachedFile = { path: string; size?: number }

const TAG = /<argus-files(?: sizes="([\d,]*)")?>\n([\s\S]*?)\n<\/argus-files>/
// Como as mensagens antigas levavam os caminhos: no fim do texto, à vista no balão.
const LEGACY = /(?:^|\n\n)Arquivos anexados:\n((?:- [^\n]+(?:\n|$))+)/

// O bloco que o agente lê. O tamanho vai num atributo, só para o cartão do balão.
export function filesBlock(files: AttachedFile[]): string {
  const sizes = files.map((f) => f.size ?? '').join(',')
  return `<argus-files sizes="${sizes}">\nAttached files (read them from disk):\n${files.map((f) => `- ${f.path}`).join('\n')}\n</argus-files>`
}

// Os arquivos de um bloco <argus-files>; nada se o texto não for um.
export function filesInBlock(text: string): AttachedFile[] {
  const m = TAG.exec(text)
  if (!m) return []
  const sizes = (m[1] ?? '').split(',')
  return listed(m[2]).map((path, i) => (sizes[i] ? { path, size: Number(sizes[i]) } : { path }))
}

// Mensagem antiga: tira a lista de caminhos do texto e devolve os arquivos dela à parte.
export function withoutLegacyFiles(text: string): { text: string; files: AttachedFile[] } {
  const m = LEGACY.exec(text)
  if (!m) return { text, files: [] }
  const rest = [text.slice(0, m.index).trim(), text.slice(m.index + m[0].length).trim()].filter(Boolean).join('\n\n')
  return { text: rest, files: listed(m[1]).map((path) => ({ path })) }
}

const listed = (lines: string) => lines.split('\n').flatMap((l) => (l.startsWith('- ') ? [l.slice(2).trim()] : []))

// Nome do arquivo no caminho, com barra de Mac/Linux ou de Windows.
export const fileName = (path: string) => path.split(/[\\/]/).pop() || path
