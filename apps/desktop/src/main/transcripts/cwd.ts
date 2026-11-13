// Pastas (`cwd`) gravadas nas linhas de uma conversa. Procura no texto, sem montar as linhas: um
// print colado na primeira mensagem deixa a linha com centenas de KB, e o `cwd` vem depois do
// conteúdo.
const CWD = /"cwd":"((?:[^"\\]|\\.)*)"/g

export function* cwdsIn(text: string): Generator<string> {
  for (const [, raw] of text.matchAll(CWD)) {
    try {
      yield JSON.parse(`"${raw}"`) as string
    } catch {
      // escape cortado no fim do trecho lido
    }
  }
}
