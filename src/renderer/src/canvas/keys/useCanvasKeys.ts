import { useEffect } from 'react'
import { useReactFlow, type XYPosition } from '@xyflow/react'
import { isMod } from '../../platform'
import type { NodesApi } from '../actions/types'
import { deletableNotes } from './deletableNotes'
import { isCanvasTarget, isEditableTarget } from './keyTargets'

type Options = Pick<NodesApi, 'nodesRef' | 'change'> & {
  undo: () => void
  redo: () => void
  addNote: (position: XYPosition) => void
  openCommandBar: () => void
  closeMenu: () => void
}

// Teclado do canvas: desfazer, barra de comando, nota nova e apagar notas. O zoom fica em
// useCanvasShortcuts (com a barra de navegação), o espaço em useSpaceHeld e o ⌘\ em useUiHidden.
export function useCanvasKeys({ nodesRef, change, undo, redo, addNote, openCommandBar, closeMenu }: Options): void {
  const { screenToFlowPosition } = useReactFlow()

  // ⌘Z / ⇧⌘Z chegam pelo menu Editar do Electron. Em campo de texto, desfaz o texto; na barra
  // de comando vazia, desfaz o que o Claude fez no canvas.
  useEffect(
    () =>
      window.api.onEdit((action) => {
        const el = document.activeElement as HTMLElement | null
        const canvasUndo = el instanceof HTMLInputElement && el.dataset.canvasUndo !== undefined && !el.value
        if (!canvasUndo && el?.closest('input, textarea, [contenteditable="true"]')) document.execCommand(action)
        else if (action === 'undo') undo()
        else redo()
      }),
    [undo, redo]
  )

  // ⌘K abre a barra de comando para digitar (o botão da barra lateral abre já ouvindo). ⌘ no Mac,
  // Ctrl no Windows: no Mac, o Ctrl+K de um campo de texto é do campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMod(e) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      openCommandBar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openCommandBar])

  // C com o mouse no canvas: nota nova ali, já para escrever (como o comentário do Figma).
  // Fora do canvas (painel, modal, barras) ou digitando, a tecla é de quem está lá.
  useEffect(() => {
    let pointer: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY })
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return
      if (isEditableTarget(e.target)) return
      const at = pointer
      const under = at && document.elementFromPoint(at.x, at.y)
      if (!at || !under?.closest('.react-flow') || under.closest('.react-flow__panel')) return
      e.preventDefault()
      closeMenu()
      addNote(screenToFlowPosition(at))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [screenToFlowPosition, closeMenu, addNote])

  // Delete (no Mac, a tecla ⌫) apaga as notas selecionadas; ⌘Z traz de volta. Só com o foco no
  // canvas (num modal ou num campo de texto, a tecla é de quem está lá) e só as que estão à vista.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.metaKey || e.ctrlKey || e.altKey) return
      if (!isCanvasTarget(e.target)) return
      const ids = deletableNotes(nodesRef.current)
      if (!ids.size) return
      e.preventDefault()
      change((ns) => ns.filter((n) => !ids.has(n.id)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nodesRef, change])
}
