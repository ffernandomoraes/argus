import type { StorageCleaner } from '../storage'
import { handle } from './register'

// O espaço das conversas e dos rascunhos do agente (aba Armazenamento das Configurações).
export function registerStorageIpc(storage: StorageCleaner): void {
  handle('storage:usage', () => storage.usage())
  handle('storage:settings', () => storage.settings())
  handle('storage:setSettings', (_e, patch) => storage.setSettings(patch))
  handle('storage:clean', () => storage.clean())
}
