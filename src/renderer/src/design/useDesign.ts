import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DESIGN_VERSION, type Design } from '../../../shared/design'

// O design aberto no drawer: lido do disco (ou novo) e atualizado pelo que a tela e a conversa
// informam. Design novo fica só aqui até começar (primeiro pedido ou tela aberta): não entra na
// lista vazio.
export function useDesign(designId: string, projectPath: string) {
  const [design, setDesign] = useState<Design | null>(null)
  // O mais novo, para duas mudanças seguidas (antes de redesenhar) não perderem uma à outra.
  const latest = useRef<Design | null>(null)
  useLayoutEffect(() => {
    latest.current = design
  })

  useEffect(() => {
    let alive = true
    window.api.design.load(designId).then(
      (saved) => {
        if (!alive) return
        const now = new Date().toISOString()
        setDesign(
          saved ?? {
            version: DESIGN_VERSION,
            id: designId,
            name: 'Novo protótipo',
            projectPath,
            device: 'desktop',
            createdAt: now,
            updatedAt: now
          }
        )
      },
      (err: unknown) => console.error('[design] abrir o design:', err)
    )
    return () => {
      alive = false
    }
  }, [designId, projectPath])

  const update = (patch: Partial<Design>) => {
    const current = latest.current
    if (!current) return
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    latest.current = next
    setDesign(next)
    if (next.sessionId || next.existing) void window.api.design.save(next)
  }

  return { design, update }
}
