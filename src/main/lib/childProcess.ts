import type { ChildProcess } from 'node:child_process'

type Stdin = NonNullable<ChildProcess['stdin']>

const guarded = new WeakSet<Stdin>()

// O processo pode sair antes de ler tudo (git fora de repositório, `claude` que morreu): a escrita
// vira EPIPE, que sem ouvinte de 'error' é exceção não tratada no processo principal (o diálogo
// de erro do Electron). Com o ouvinte, o erro é só ignorado; quem quer saber se o processo
// terminou bem olha o 'exit'/'close' dele.
export function guardStdin(child: ChildProcess): void {
  const stdin = child.stdin
  if (!stdin || guarded.has(stdin)) return
  stdin.on('error', () => {})
  guarded.add(stdin)
}

// Escreve no stdin do processo filho com o ouvinte de erro posto. Por padrão fecha o stdin depois
// (entrada de uma vez, como o `git check-ignore --stdin`); `end: false` para conversa contínua
// (o `claude` do monitor de uso). Devolve false se o stdin já estava fechado.
export function writeStdin(child: ChildProcess, data: string | Uint8Array, { end = true }: { end?: boolean } = {}): boolean {
  const stdin = child.stdin
  if (!stdin) return false
  guardStdin(child)
  if (stdin.destroyed || stdin.writableEnded) return false
  if (end) stdin.end(data)
  else stdin.write(data)
  return true
}
