// Corta o markdown em trechos que, lidos um a um, dão o mesmo resultado que o texto inteiro: o
// corte é numa linha em branco seguida de uma linha sem recuo que não é item de lista, e nunca
// dentro de um bloco de código (``` ou ~~~). Lista com linha em branco entre os itens, parágrafo
// recuado dentro de item e código recuado ficam no mesmo trecho.

// Abertura de bloco de código: até 3 espaços de recuo e 3 ou mais crases ou tis. Com crases, a
// informação depois delas não pode ter crase (como no CommonMark): "```a``` b" é código em linha.
const FENCE_OPEN = /^ {0,3}(`{3,})[^`]*$|^ {0,3}(~{3,})/
// Fechamento: o mesmo caractere, pelo menos do mesmo tamanho, e nada depois.
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/
const LIST_ITEM = /^([-*+]|\d{1,9}[.)])(\s|$)/
// Nota de rodapé ou link por referência: liga pedaços distantes do texto.
const DEFINITION = /^ {0,3}\[[^\]]+\]:/m
// Comentário e blocos de HTML que atravessam linhas em branco.
const HTML_BLOCK = /<!--|<(pre|script|style|textarea)[\s>]/i

// Na dúvida, o texto vai inteiro: não cortar é sempre igual ao texto inteiro, só mais lento.
export function splitMarkdownBlocks(text: string): string[] {
  if (DEFINITION.test(text) || HTML_BLOCK.test(text)) return [text]
  const lines = text.split('\n')
  const blocks: string[] = []
  let start = 0
  let fence: string | null = null
  let afterBlank = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (fence) {
      const close = FENCE_CLOSE.exec(line)
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null
      continue
    }
    if (line.trim() === '') {
      afterBlank = true
      continue
    }
    if (afterBlank && i > start && !/^\s/.test(line) && !LIST_ITEM.test(line)) {
      blocks.push(lines.slice(start, i).join('\n'))
      start = i
    }
    afterBlank = false
    const open = FENCE_OPEN.exec(line)
    fence = open ? (open[1] ?? open[2]) : null
  }
  blocks.push(lines.slice(start).join('\n'))
  return blocks
}
