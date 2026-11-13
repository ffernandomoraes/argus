// Windows: enquanto o `claude update` troca o claude.exe, nenhum `claude` do Argus abre (o arquivo
// pode estar pela metade ou fora do lugar, e a conversa não abriria). Quem for abrir espera a troca
// terminar: o processo do SDK espera por heldProcess (chats/heldProcess.ts), o resto por
// claudeReady. Cada hold devolve a sua liberação; o caminho abre quando todas forem liberadas.

let holds = 0
let waiters: (() => void)[] = []

export function holdClaude(): () => void {
  holds++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--holds > 0) return
    const ready = waiters
    waiters = []
    ready.forEach((r) => r())
  }
}

export const claudeHeld = (): boolean => holds > 0

export function claudeReady(): Promise<void> {
  if (!holds) return Promise.resolve()
  return new Promise((resolve) => waiters.push(resolve))
}
