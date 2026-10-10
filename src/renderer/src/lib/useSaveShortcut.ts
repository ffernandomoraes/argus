import { useEffect, useEffectEvent } from 'react'
import { isMod } from '../platform'

// ⌘S (Ctrl+S no Windows) chama `save` enquanto o componente estiver na tela. Segurar a tecla não
// grava de novo a cada repetição. Com `enabled` falso, a tecla passa adiante.
export function useSaveShortcut(save: () => unknown, enabled = true): void {
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!enabled || !isMod(e) || e.key !== 's') return
    e.preventDefault()
    if (!e.repeat) void save()
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
