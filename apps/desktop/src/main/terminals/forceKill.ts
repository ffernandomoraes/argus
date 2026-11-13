import { IS_WIN } from '../platform'

// Se o terminal não sair com o pedido educado, encerra à força: nada pode ficar rodando atrás. No
// Mac, o grupo inteiro: o terminal abre o programa num grupo próprio, e é nele que o `claude` põe
// os servidores MCP. Sem o grupo, só o processo.
export function forceKillLater(pid: number, afterMs = 2000): void {
  setTimeout(() => {
    if (!IS_WIN) {
      try {
        process.kill(-pid, 'SIGKILL')
        return
      } catch {
        // O grupo já não existe: confere o processo sozinho.
      }
    }
    try {
      process.kill(pid, 0)
      process.kill(pid, 'SIGKILL')
    } catch {
      // já saiu
    }
  }, afterMs).unref()
}
