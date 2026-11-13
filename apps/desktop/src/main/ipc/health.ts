import type { SystemHealth } from '../systemHealth'
import { handle, on } from './register'

// Memória e disco do computador, para o aviso da barra de cima.
export function registerHealthIpc(health: SystemHealth): void {
  handle('health:get', () => health.get())
  handle('health:read', () => health.read())
  on('health:dismiss', () => health.dismiss())
}
