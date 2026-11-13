import { join } from 'node:path'

// O 'electron' nos testes (ver vitest.config.ts). Só o que o código usa ao ser carregado e nas
// funções testadas; o resto responde sem fazer nada. Pastas do app (userData...) ficam dentro da
// pasta pessoal falsa de test/setup.ts.

const noop = () => undefined

// Qualquer método não listado vira uma função vazia. "then" fica de fora: senão o objeto pareceria
// uma promessa para quem der await nele.
function stub<T extends object>(base: T): T {
  return new Proxy(base, {
    get: (target, key) => (key in target || typeof key === 'symbol' || key === 'then' ? Reflect.get(target, key) : noop)
  })
}

export const app = stub({
  getPath: (name: string) => join(process.env.HOME ?? '', 'electron', name),
  getVersion: () => '0.0.0-test',
  getName: () => 'Argus',
  isPackaged: false,
  getPreferredSystemLanguages: () => ['pt-BR'],
  getLocale: () => 'pt-BR',
  isReady: () => true,
  whenReady: () => Promise.resolve(),
  on: () => app,
  once: () => app
})

export class BrowserWindow {
  static getAllWindows = (): BrowserWindow[] => []
  static getFocusedWindow = (): BrowserWindow | null => null
  static fromWebContents = (): BrowserWindow | null => null
}

export const ipcMain = stub({})
export const shell = stub({})
export const dialog = stub({})
export const clipboard = stub({})
export const screen = stub({ getAllDisplays: () => [] })
export const nativeTheme = stub({ shouldUseDarkColors: false, on: noop })
export const nativeImage = stub({})
export const net = stub({})
export const Menu = stub({})
export const Tray = stub({})
export const Notification = stub({ isSupported: () => false })
export const utilityProcess = stub({})
export const systemPreferences = stub({})
export const session = stub({})
export const safeStorage = stub({ isEncryptionAvailable: () => false })
export const powerSaveBlocker = stub({})
export const powerMonitor = stub({})
