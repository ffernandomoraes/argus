import { readdir, stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import { join } from 'node:path'

export type DirWatch = { close(): void }

// Pasta de rede (\\servidor\..., como as do WSL: \\wsl.localhost\Ubuntu\...): o Windows não avisa
// de forma confiável quando algo muda lá dentro. Ela é conferida a cada POLL_MS, pela data e pelo
// tamanho de cada arquivo.
const POLL_MS = 1500
const isNetworkPath = (dir: string) => /^[\\/]{2}[^\\/]/.test(dir)

// Vigia uma pasta. Pasta que ainda não existe: nulo (na pasta de rede, o onError logo depois, ver
// pollDir). Erro depois (pasta apagada, sem permissão): fecha e chama onError, para quem guarda o
// vigia pôr nulo e abrir de novo depois (antes ele ficava fechado para sempre, mas no mapa como
// aberto).
export function watchDir(dir: string, onEvent: (file: string | null) => void, onError: () => void): DirWatch | null {
  if (isNetworkPath(dir)) return pollDir(dir, onEvent, onError)
  try {
    const w = watch(dir, (_event, file) => onEvent(file))
    w.on('error', () => {
      w.close()
      onError()
    })
    return w
  } catch {
    return null
  }
}

// Sem conferir na hora se a pasta existe: conferir pela rede, síncrono, travava o app inteiro
// enquanto o WSL não respondia (2026-10-23). A primeira leitura serve de conferência: sem a pasta,
// ela falha e chama onError.
function pollDir(dir: string, onEvent: (file: string | null) => void, onError: () => void): DirWatch {
  let seen: Map<string, string> | null = null
  let closed = false
  let busy = false
  const check = async () => {
    if (busy || closed) return
    busy = true
    try {
      const now = new Map<string, string>()
      for (const name of await readdir(dir)) {
        const info = await stat(join(dir, name)).catch(() => null)
        if (info) now.set(name, `${info.mtimeMs}:${info.size}`)
      }
      if (closed) return
      if (seen) {
        for (const [name, sig] of now) if (seen.get(name) !== sig) onEvent(name)
        for (const name of seen.keys()) if (!now.has(name)) onEvent(name)
      }
      seen = now
    } catch {
      if (closed) return
      closed = true
      clearInterval(timer)
      onError()
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void check(), POLL_MS)
  void check()
  return {
    close: () => {
      closed = true
      clearInterval(timer)
    }
  }
}
