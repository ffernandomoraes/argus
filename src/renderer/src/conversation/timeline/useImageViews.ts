import { useCallback, useLayoutEffect, useState } from 'react'
import { createImageViews } from './imageViews'

type Viewer = { load: () => Promise<string[]>; start: number }

// Imagens das mensagens da conversa e o preview aberto. viewFor é fixo enquanto a conversa está na
// tela, e cada mensagem recebe sempre o mesmo objeto (ver imageViews).
export function useImageViews(read?: (messageId: string) => Promise<string[]>) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [views] = useState(() => createImageViews((load, start) => setViewer({ load, start })))
  useLayoutEffect(() => views.setReader(read))
  const close = useCallback(() => setViewer(null), [])
  return { viewer, close, viewFor: views.viewFor }
}
