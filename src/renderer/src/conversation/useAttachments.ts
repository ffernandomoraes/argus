import { useCallback, useEffect, useRef, useState } from 'react'

export type Attachment = {
  id: string
  file: File
  // Endereço local para mostrar a miniatura; só existe para imagens.
  previewUrl?: string
}

const NONE: Attachment[] = []

// Anexos da mensagem que está sendo escrita: escolhidos pelo botão ou colados (⌘V). Os endereços
// das miniaturas ficam fora do estado, num mapa só deste campo: são liberados ao tirar o anexo, ao
// enviar e ao sair da conversa (antes, a saída olhava a lista vazia do primeiro desenho e nada
// era liberado).
export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>(NONE)
  const urls = useRef(new Map<string, string>())

  const add = useCallback((files: FileList | File[]) => {
    const next = Array.from(files).map((file): Attachment => {
      const id = crypto.randomUUID()
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (previewUrl) urls.current.set(id, previewUrl)
      return { id, file, previewUrl }
    })
    if (next.length) setItems((all) => [...all, ...next])
  }, [])

  const remove = useCallback((id: string) => {
    const url = urls.current.get(id)
    if (url) URL.revokeObjectURL(url)
    urls.current.delete(id)
    setItems((all) => all.filter((a) => a.id !== id))
  }, [])

  // Depois de enviar: o campo fica limpo.
  const clear = useCallback(() => {
    revokeAll(urls.current)
    setItems(NONE)
  }, [])

  // Libera as miniaturas ao sair da conversa.
  useEffect(() => {
    const map = urls.current
    return () => revokeAll(map)
  }, [])

  return { items, add, remove, clear }
}

function revokeAll(map: Map<string, string>): void {
  for (const url of map.values()) URL.revokeObjectURL(url)
  map.clear()
}
