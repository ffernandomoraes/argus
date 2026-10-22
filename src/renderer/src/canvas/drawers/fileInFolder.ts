import { IS_WIN, SEP, baseName, isAbsolutePath, parentDir, relativeTo, untildify } from '../../platform'

// Link de arquivo no chat: o caminho na árvore da pasta (relativo, com "/"), ou nulo fora dela,
// onde o visualizador não tem acesso. Aceita caminho relativo à pasta ou absoluto dentro dela.
export function fileInFolder(root: string, path: string): string | null {
  const full = untildify(path)
  // Relativo: já é o caminho na árvore, com "/" (o Claude no Windows pode mandar com barra invertida).
  const rel = isAbsolutePath(full) ? relativeTo(full, untildify(root)) : IS_WIN ? full.replace(/\\/g, '/') : full
  return rel ? rel.replace(/^\.\//, '') : null
}

// Link para um arquivo fora das pastas da conversa (a temporária do Claude, a da memória): a pasta
// do próprio arquivo faz de raiz, porque o código e o principal só mexem no que está dentro de uma.
// "/a.pdf" e "C:\a.pdf" ficam com "/" e "C:\". Nulo para caminho relativo, que não diz onde está.
export function ownFolder(path: string): { root: string; rel: string } | null {
  const full = untildify(path).replace(/[\\/]+$/, '')
  if (!isAbsolutePath(full)) return null
  const dir = parentDir(full)
  return { root: isAbsolutePath(dir) ? dir : dir + SEP, rel: baseName(full) }
}
