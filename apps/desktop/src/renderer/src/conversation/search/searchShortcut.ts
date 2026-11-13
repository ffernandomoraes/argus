import { useEffect, useEffectEvent, type RefObject } from 'react'
import { IS_MAC, isMod } from '../../platform'

// ⌘F (Ctrl+F no Windows e no Linux) abre a busca na conversa do drawer. Com mais de um drawer à
// vista, vale o que tem o foco; sem foco em nenhum, o último em que você clicou ou que abriu.
// Foco num campo ou terminal fora dos drawers (o editor do código, a busca do canvas): o atalho
// fica com ele.
type Target = { el: RefObject<HTMLElement | null>; open: () => void }

// Do menos ao mais recente.
const targets: Target[] = []

function touch(target: Target): void {
  const i = targets.indexOf(target)
  if (i >= 0) targets.splice(i, 1)
  targets.push(target)
}

const editable = (el: Element): boolean =>
  (el instanceof HTMLElement && el.isContentEditable) || el.matches('input, textarea, select') || !!el.closest('.xterm, .cm-editor')

function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.isComposing || !isMod(e) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
  const active = document.activeElement
  // No terminal do Windows e do Linux, Ctrl+F é do shell (anda um caractere).
  if (!IS_MAC && active?.closest('.xterm')) return
  let target = active ? targets.find((t) => t.el.current?.contains(active)) : undefined
  if (!target) {
    if (active && active !== document.body && editable(active)) return
    target = targets[targets.length - 1]
  }
  if (!target) return
  e.preventDefault()
  target.open()
}

export function useSearchShortcut(ref: RefObject<HTMLElement | null>, onOpen: () => void): void {
  const open = useEffectEvent(onOpen)
  useEffect(() => {
    const target: Target = { el: ref, open: () => open() }
    if (!targets.length) window.addEventListener('keydown', onKeyDown)
    targets.push(target)
    const el = ref.current
    const mark = () => touch(target)
    el?.addEventListener('pointerdown', mark, true)
    el?.addEventListener('focusin', mark)
    return () => {
      el?.removeEventListener('pointerdown', mark, true)
      el?.removeEventListener('focusin', mark)
      const i = targets.indexOf(target)
      if (i >= 0) targets.splice(i, 1)
      if (!targets.length) window.removeEventListener('keydown', onKeyDown)
    }
  }, [ref])
}
