import { useCallback, useEffect, useState, type RefObject } from 'react'
import { useEscape } from '../useEscape'
import { holdOpenAnchor, useOutsideClick } from '../useOutsideClick'

type ElementRef = RefObject<HTMLElement | null>

// Menu que abre a partir de um botão: o botão alterna (abre e fecha), o clique fora e o Esc fecham,
// e o clique no próprio botão não fecha e reabre. Os refs vêm de quem usa (useRef no componente):
// devolver refs junto do `open` faria o React Compiler tratar toda leitura de `menu.open` como
// leitura de ref no render. `menuRef`: só se o menu for seu (o clique fora fica por conta daqui);
// com o ContextMenu, que já fecha sozinho com clique fora, não passe e use `close` como onClose dele.
export function useAnchoredMenu(anchorRef: ElementRef, menuRef?: ElementRef, initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => (open ? holdOpenAnchor(anchorRef) : undefined), [open, anchorRef])
  // Menu ainda não desenhado (ref vazio): o clique não conta como fora.
  useOutsideClick(menuRef ?? anchorRef, () => menuRef?.current && close(), open && !!menuRef)
  useEscape(close, open)

  return { open, setOpen, toggle, close }
}
