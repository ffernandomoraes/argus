import { IS_WIN, isAbsolutePath, relativeTo, untildify } from '../../platform'

// Link de arquivo no chat: o caminho na árvore da pasta (relativo, com "/"), ou nulo fora dela,
// onde o visualizador não tem acesso. Aceita caminho relativo à pasta ou absoluto dentro dela.
export function fileInFolder(root: string, path: string): string | null {
  const full = untildify(path)
  // Relativo: já é o caminho na árvore, com "/" (o Claude no Windows pode mandar com barra invertida).
  const rel = isAbsolutePath(full) ? relativeTo(full, untildify(root)) : IS_WIN ? full.replace(/\\/g, '/') : full
  return rel ? rel.replace(/^\.\//, '') : null
}
