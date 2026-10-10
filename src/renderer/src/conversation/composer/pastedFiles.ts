// ⌘V com imagem ou arquivo copiado vira anexo; texto colado segue normal. Planilha e editor de
// texto (Excel, Numbers, Word) copiam o texto junto com uma imagem dele: com texto e sem nenhum
// arquivo de verdade no disco (o caminho vem vazio), vale o texto. Só quando parece vir de um
// deles: HTML com tabela, ou texto de mais de uma linha. Uma imagem com uma legenda curta (navegador,
// app de chat) continua virando anexo. Devolve o que anexar (nada: deixa colar).
export function pastedFiles(
  data: { files: ArrayLike<File>; types: readonly string[]; getData: (type: string) => string },
  pathOf: (file: File) => string
): File[] {
  const files = Array.from(data.files)
  if (!files.length) return []
  if (!data.types.includes('text/plain') || files.some((f) => pathOf(f))) return files
  const table = data.types.includes('text/html') && /<table[\s>]/i.test(data.getData('text/html'))
  const lines = data.getData('text/plain').trim().split(/\r?\n/).length > 1
  return table || lines ? [] : files
}
