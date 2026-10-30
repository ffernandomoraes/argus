import { memo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { BoardSummary } from '../../../../shared/canvas'
import { Presence } from '../../motion'
import { IconButton } from '../../ui/IconButton'
import { MenuArrow } from '../../ui/MenuArrow'
import { MENU_PANEL, MENU_ROW } from '../../ui/menuStyles'
import { useAnchoredMenu } from '../../ui/useAnchoredMenu'
import { useActiveChats } from '../activeChats'
import { createBoard, switchBoard, useBoards, useCurrentBoard } from '../boards'
import type { ConfirmRequest } from '../ConfirmDialog'
import { TRASH_EN } from '../menus/shared'
import { StatusDot } from '../StatusBadge'
import { useInterruptedChats } from '../interruptedChats'
import { boardStatus, useDoneBoards, type BoardStatus } from './boardActivity'
import { tr } from '../../i18n'

const PANEL_WIDTH = 256

// O mais urgente entre vários.
const mostUrgent = (list: BoardStatus[]): BoardStatus =>
  (['needs-you', 'running', 'interrupted', 'done'] as const).find((s) => list.includes(s)) ?? null

// Workspaces na barra de título, colados ao botão de fechar: o nome do atual abre a lista para
// trocar, criar, renomear e fechar. `align`: a ponta da barra onde ele está (a lista abre para
// dentro). Fechar só tira da lista (o canvas fica guardado e os terminais rodando); os fechados
// ficam embaixo, para reabrir ou excluir de vez. Cada workspace mostra se tem conversa esperando
// você, trabalhando ou concluída sem você ver; o botão também, quando é num workspace fora da tela.
export const BoardSwitcher = memo(function BoardSwitcher({
  confirm,
  align
}: {
  confirm: (request: ConfirmRequest) => void
  align: 'start' | 'end'
}) {
  const boards = useBoards()
  const current = useCurrentBoard()
  const chats = useActiveChats()
  const done = useDoneBoards()
  const interrupted = useInterruptedChats()
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const menu = useAnchoredMenu(anchor, panel)
  // Workspace com o nome em edição, ou 'new' para o campo do workspace novo.
  const [editing, setEditing] = useState<string | null>(null)

  const status = new Map(boards.map((b) => [b.id, boardStatus(b, chats, done, interrupted)]))
  const elsewhere = mostUrgent(boards.filter((b) => b.id !== current).map((b) => status.get(b.id) ?? null))
  const name = boards.find((b) => b.id === current)?.name ?? ''
  const open = boards.filter((b) => !b.closed)
  const closed = boards.filter((b) => b.closed)

  const toggle = () => {
    setEditing(null)
    menu.toggle()
  }
  // Fechado também: abre de novo e vai para ele.
  const pick = (id: string) => {
    menu.close()
    switchBoard(id)
  }
  // Enter sem nome cria com um nome de reserva; clicar fora sem nome desiste.
  const create = (typed: string | null, entered: boolean) => {
    setEditing(null)
    if (typed === null || (!typed.trim() && !entered)) return
    menu.close()
    createBoard(typed.trim() || tr(`Workspace ${boards.length + 1}`, `Workspace ${boards.length + 1}`))
  }
  const rename = (id: string, typed: string | null) => {
    setEditing(null)
    if (typed?.trim()) window.api.boards.rename(id, typed)
  }
  const remove = (board: BoardSummary) => {
    menu.close()
    confirm({
      title: tr(`Excluir o workspace "${board.name}"?`, `Delete the workspace "${board.name}"?`),
      description: tr(
        'O canvas dele vai para a Lixeira e os terminais abertos nele são fechados. As pastas e as conversas continuam no computador.',
        `Its canvas goes to the ${TRASH_EN} and the terminals open in it are closed. The folders and chats stay on your computer.`
      ),
      confirmLabel: tr('Excluir workspace', 'Delete workspace'),
      onConfirm: () => window.api.boards.remove(board.id)
    })
  }

  return (
    // Fora da área que arrasta a janela, senão o botão não recebe o mouse.
    <div className="no-drag relative flex">
      <button
        ref={anchor}
        onClick={toggle}
        aria-expanded={menu.open}
        aria-label={tr(`Workspace: ${name}`, `Workspace: ${name}`)}
        // O mesmo selo da branch acima da pasta (project/BranchSwitcher).
        className={`flex h-6 max-w-64 min-w-0 items-center gap-1.5 rounded-md border border-line px-2 text-[12px] shadow-sm ${
          menu.open ? 'bg-surface-2 text-text' : 'bg-surface text-muted hover:bg-surface-2 hover:text-text'
        }`}
      >
        <span className="truncate">{name}</span>
        {elsewhere && <StatusDot status={elsewhere} />}
        <ChevronDown size={12} className="-mr-0.5 shrink-0" aria-hidden="true" />
      </button>
      <Presence kind="menu">
        {menu.open && (
          <div
            ref={panel}
            style={{ width: PANEL_WIDTH }}
            className={`absolute top-full mt-2 ${align === 'start' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} ${MENU_PANEL}`}
          >
            <MenuArrow side="top" align={align} at={20} />
            <div className="max-h-[60vh] overflow-y-auto">
              <ul>
                {open.map((b) =>
                  editing === b.id ? (
                    <li key={b.id}>
                      <NameField initial={b.name} onDone={(typed) => rename(b.id, typed)} />
                    </li>
                  ) : (
                    <BoardRow key={b.id} board={b} status={status.get(b.id) ?? null} selected={b.id === current} onPick={() => pick(b.id)}>
                      <IconButton label={tr('Renomear workspace', 'Rename workspace')} variant="subtle" size="xs" onClick={() => setEditing(b.id)}>
                        <Pencil size={12} />
                      </IconButton>
                      {open.length > 1 && (
                        <IconButton
                          label={tr('Fechar workspace (os terminais continuam rodando)', 'Close workspace (terminals keep running)')}
                          variant="subtle"
                          size="xs"
                          onClick={() => window.api.boards.close(b.id)}
                        >
                          <X size={13} />
                        </IconButton>
                      )}
                    </BoardRow>
                  )
                )}
              </ul>
              {closed.length > 0 && (
                <>
                  <div className="my-1 h-px bg-line" />
                  <p className="px-2 pt-1 pb-0.5 text-[11px] text-faint">{tr('Fechados', 'Closed')}</p>
                  <ul>
                    {closed.map((b) => (
                      <BoardRow key={b.id} board={b} status={status.get(b.id) ?? null} selected={false} onPick={() => pick(b.id)}>
                        <IconButton label={tr('Reabrir workspace', 'Reopen workspace')} variant="subtle" size="xs" onClick={() => window.api.boards.reopen(b.id)}>
                          <RotateCcw size={12} />
                        </IconButton>
                        <IconButton label={tr('Excluir workspace', 'Delete workspace')} variant="subtle" size="xs" danger onClick={() => remove(b)}>
                          <Trash2 size={12} />
                        </IconButton>
                      </BoardRow>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="my-1 h-px bg-line" />
            {editing === 'new' ? (
              <NameField initial="" placeholder={tr('Nome do workspace', 'Workspace name')} onDone={create} />
            ) : (
              <button onClick={() => setEditing('new')} className={`${MENU_ROW} text-muted hover:bg-fill hover:text-text`}>
                <Plus size={13} className="shrink-0" />
                {tr('Novo workspace', 'New workspace')}
              </button>
            )}
          </div>
        )}
      </Presence>
    </div>
  )
})

// Uma linha: status, nome e o visto no atual; com o mouse em cima, as ações (children).
function BoardRow({
  board,
  status,
  selected,
  onPick,
  children
}: {
  board: BoardSummary
  status: BoardStatus
  selected: boolean
  onPick: () => void
  children: ReactNode
}) {
  return (
    <li className="group/board flex items-center rounded-md hover:bg-fill">
      <button onClick={onPick} className={`${MENU_ROW} min-w-0 flex-1 hover:bg-transparent`}>
        <span className="flex w-3 shrink-0 justify-center">{status && <StatusDot status={status} />}</span>
        <span className={`min-w-0 flex-1 truncate ${selected ? 'font-medium text-text' : 'text-muted group-hover/board:text-text'}`}>
          {board.name}
        </span>
        {selected && <Check size={13} className="shrink-0 text-accent group-hover/board:hidden" />}
      </button>
      <span className="hidden shrink-0 items-center pr-0.5 group-hover/board:flex">{children}</span>
    </li>
  )
}

// Campo do nome (renomear ou criar): Enter guarda, Esc cancela, clicar fora guarda. `entered`: saiu
// pelo Enter.
function NameField({
  initial,
  placeholder,
  onDone
}: {
  initial: string
  placeholder?: string
  onDone: (typed: string | null, entered: boolean) => void
}) {
  const cancelled = useRef(false)
  const entered = useRef(false)
  return (
    <input
      autoFocus
      defaultValue={initial}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        // Compondo um acento ou um ideograma (IME), Enter e Esc são da composição.
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') {
          entered.current = true
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          // Só cancela o nome; o menu continua aberto.
          e.preventDefault()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => onDone(cancelled.current ? null : e.currentTarget.value, entered.current)}
      className="my-px w-full rounded-md border border-line-strong bg-bg px-2 py-1 text-xs text-text outline-none placeholder:text-faint"
    />
  )
}
