// Saída de quem o play iniciou. Lógica pura.

// Só o fim da saída interessa: é onde fica o erro de quem não subiu.
export const OUTPUT_LIMIT = 8000

// Última linha com texto, sem as cores do terminal.
export function lastLine(output: string): string {
  const lines = output
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return (lines.pop() ?? '').slice(0, 200)
}
