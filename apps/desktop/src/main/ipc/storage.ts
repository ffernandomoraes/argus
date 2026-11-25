import type { StorageCleaner } from '../storage';
import { handle } from './register';

// O espaço das conversas e dos rascunhos do agente (aba Armazenamento das Configurações). changed:
// os prazos mudaram (a conta do Argus leva para os outros computadores).
export function registerStorageIpc(storage: StorageCleaner, changed: () => void): void {
  handle('storage:usage', () => storage.usage());
  handle('storage:settings', () => storage.settings());
  handle('storage:setSettings', (_e, patch) => {
    const saved = storage.setSettings(patch);
    changed();
    return saved;
  });
  handle('storage:clean', () => storage.clean());
}
