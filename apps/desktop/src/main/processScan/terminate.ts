import { IS_WIN } from '../platform'
import { killTree } from '../winProcesses'
import { isOwnGroup } from './ownGroup'

function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

// Encerra o grupo inteiro do servidor (pnpm + vite). Quem ignorar o SIGTERM leva SIGKILL depois de
// alguns segundos. No Windows, o processo e tudo que ele abriu saem de uma vez (taskkill). Nunca o
// grupo do próprio Argus, a não ser pedido de propósito (`own`): o "Encerrar - fecha este app" do
// painel, no pnpm dev dele.
export async function terminate(pgid: number, { own = false }: { own?: boolean } = {}): Promise<boolean> {
  if (pgid <= 1) return false
  if (!own && (await isOwnGroup(pgid))) return false
  if (IS_WIN) return killTree(pgid)
  try {
    process.kill(-pgid, 'SIGTERM')
  } catch {
    return false
  }
  for (let i = 0; i < 30 && groupAlive(pgid); i++) await new Promise((r) => setTimeout(r, 100))
  if (groupAlive(pgid)) {
    try {
      process.kill(-pgid, 'SIGKILL')
    } catch {
      // Saiu entre a conferência e o sinal.
    }
  }
  return true
}
