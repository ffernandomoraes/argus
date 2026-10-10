import { watch, type FSWatcher } from 'node:fs'

// Vigia uma pasta. Pasta que ainda não existe: nulo. Erro depois (pasta apagada, sem permissão):
// fecha e chama onError, para quem guarda o vigia pôr nulo e abrir de novo depois (antes ele ficava
// fechado para sempre, mas no mapa como aberto).
export function watchDir(dir: string, onEvent: (file: string | null) => void, onError: () => void): FSWatcher | null {
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
