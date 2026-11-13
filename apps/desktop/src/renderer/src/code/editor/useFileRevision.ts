import { useEffect, useState } from 'react'

// Sobe a cada mudança do arquivo no disco (o Claude editou, por exemplo), enquanto ele está aberto.
// Começa em 0: a primeira leitura é de quem abre. Outro arquivo é outro FileViewer (CodePanel
// troca a key), e a contagem recomeça.
export function useFileRevision(root: string, path: string): number {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    window.api.files.watch(root, path)
    const off = window.api.files.onChanged((r, p) => {
      if (r === root && p === path) setRevision((n) => n + 1)
    })
    return () => {
      off()
      window.api.files.unwatch()
    }
  }, [root, path])

  return revision
}
