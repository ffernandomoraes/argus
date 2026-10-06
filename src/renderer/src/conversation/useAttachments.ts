import { useCallback, useEffect, useState } from 'react'

export type Attachment = {
  id: string
  file: File
  // Endereço local para mostrar a miniatura; só existe para imagens.
  previewUrl?: string
}

// Anexos da mensagem que está sendo escrita: escolhidos pelo botão ou colados (⌘V).
export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([])

  const add = useCallback((files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }))
    setItems((all) => [...all, ...next])
  }, [])

  const remove = useCallback((id: string) => {
    setItems((all) => {
      const gone = all.find((a) => a.id === id)
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
      return all.filter((a) => a.id !== id)
    })
  }, [])

  // Libera as miniaturas ao sair da conversa.
  useEffect(() => () => items.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl)), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Depois de enviar: o campo fica limpo.
  const clear = useCallback(() => {
    setItems((all) => {
      all.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
      return []
    })
  }, [])

  return { items, add, remove, clear }
}
