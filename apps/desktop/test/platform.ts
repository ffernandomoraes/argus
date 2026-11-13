import { vi } from 'vitest'

type Api = { platform: string; homeDir: string }

const HOMES: Record<string, string> = { win32: 'C:\\Users\\ana', darwin: '/Users/ana', linux: '/home/ana' }

// Carrega módulos da interface como se ela rodasse em outro sistema: o platform.ts lê o sistema
// ao ser carregado, então os módulos são carregados de novo depois da troca. Assim o Mac também
// confere o comportamento do Windows (e o CI do Windows confere o resto de verdade).
//   const { relativeTo } = await asPlatform('win32', () => import('./platform'))
export async function asPlatform<T>(platform: 'win32' | 'darwin' | 'linux', load: () => Promise<T>, homeDir = HOMES[platform]): Promise<T> {
  const api = (globalThis as unknown as { window: { api: Api } }).window.api
  api.platform = platform
  api.homeDir = homeDir
  vi.resetModules()
  return load()
}
