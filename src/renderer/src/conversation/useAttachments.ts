import { useCallback, useEffect, useRef, useState } from 'react'
import { forgetTranscripts, watchAudio } from './audio/transcripts'

export type Attachment = {
  id: string
  file: File
  // Endereço local para mostrar a miniatura; só existe para imagens.
  previewUrl?: string
}

type Saved = { id: string; file: File }

const NONE: Attachment[] = []

// Anexos não enviados, por conversa, como o texto em useDraft: sair da conversa (ESC, X, trocar)
// não perde os prints colados. Guarda só o arquivo; a miniatura é refeita ao voltar. Vale enquanto
// o app está aberto.
const saved = new Map<string, Saved[]>()

// Anexos da mensagem que está sendo escrita: escolhidos pelo botão ou colados (⌘V). Os endereços
// das miniaturas ficam fora do estado, num mapa só deste campo: são liberados ao tirar o anexo, ao
// enviar e ao sair da conversa (antes, a saída olhava a lista vazia do primeiro desenho e nada
// era liberado). A chave pode mudar com o campo na tela (conversa nova que ganhou o id da sessão):
// os anexos continuam, e o guardado passa para a chave nova.
export function useAttachments(key: string) {
  const urls = useRef(new Map<string, string>())
  // Os guardados voltam sem miniatura; ela é refeita no efeito de entrada, abaixo.
  const [items, setItems] = useState<Attachment[]>(() => saved.get(key) ?? NONE)
  const savedAs = useRef(key)

  useEffect(() => {
    if (savedAs.current !== key) {
      saved.delete(savedAs.current)
      savedAs.current = key
    }
    if (items.length) saved.set(key, items.map(({ id, file }) => ({ id, file })))
    else saved.delete(key)
  }, [key, items])

  const add = useCallback((files: FileList | File[]) => {
    const next = Array.from(files).map((file) => withPreview({ id: crypto.randomUUID(), file }, urls.current))
    if (next.length) setItems((all) => [...all, ...next])
    // Áudio, com a transcrição ligada (Experimentos), começa a ser transcrito já ao anexar.
    for (const a of next) void watchAudio(a.file)
  }, [])

  const remove = useCallback(
    (id: string) => {
      const url = urls.current.get(id)
      if (url) URL.revokeObjectURL(url)
      urls.current.delete(id)
      forgetTranscripts(items.filter((a) => a.id === id).map((a) => a.file))
      setItems((all) => all.filter((a) => a.id !== id))
    },
    [items]
  )

  // Depois de enviar: o campo fica limpo.
  const clear = useCallback(() => {
    revokeAll(urls.current)
    setItems(NONE)
  }, [])

  // Refaz as miniaturas ao entrar e as libera ao sair da conversa (os arquivos continuam
  // guardados). Feito aqui, e não no estado inicial, porque o StrictMode sai e entra de novo.
  useEffect(() => {
    const map = urls.current
    setItems((all) => (all.length ? all.map((a) => withPreview(a, map)) : all))
    return () => revokeAll(map)
  }, [])

  return { items, add, remove, clear }
}

function withPreview({ id, file }: Saved, map: Map<string, string>): Attachment {
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
  if (previewUrl) map.set(id, previewUrl)
  return { id, file, previewUrl }
}

function revokeAll(map: Map<string, string>): void {
  for (const url of map.values()) URL.revokeObjectURL(url)
  map.clear()
}
