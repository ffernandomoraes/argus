import { memo, useEffect, useRef, useState } from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import { Bot, Brain, FolderPlus, Menu, MessageCirclePlus, Server, Settings, SquareDashed, StickyNote, type LucideIcon } from 'lucide-react'
import { PANEL_TOP } from '../conversation/FloatingPanel'
import { Presence } from '../motion'
import { IS_WIN, isMod, keys } from '../platform'
import { MenuArrow } from '../ui/MenuArrow'
import { MENU_PANEL, MENU_ROW } from '../ui/menuStyles'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { useCanvasActions } from './CanvasContext'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { tr } from '../i18n'

// `shortcut` vem escrito como no Mac ("⇧⌘A") e aparece do jeito do sistema (keys). `key` é a letra
// que, com ⌘ (Ctrl no Windows), dispara o item; sem ela, o atalho é tratado em outro lugar (a nota,
// o ⌘ , das configurações).
type Item = { label: string; icon: LucideIcon; shortcut?: string; key?: string; shift?: boolean; onClick: () => void }

const Divider = () => <span className="mx-2 my-1 block h-px bg-line" />

// Botão "Menu" no canto superior esquerdo: guarda o que antes ficava numa barra lateral (blocos
// novos, agentes, servidores, memória e configurações), para a interface ficar mais limpa.
export const NavBar = memo(function NavBar({ zoomShortcuts = true }: { zoomShortcuts?: boolean }) {
  const [open, setOpen] = useState(false)
  // Botão e menu num elemento só: o clique no botão não conta como fora.
  const ref = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { addGroup, addFolder, addNote, newLooseConversation, openSettings, openMemory, openAgents, openDevServers } =
    useCanvasActions()
  useCanvasShortcuts(zoomShortcuts)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  // Blocos novos nascem no meio da tela.
  const center = () => {
    const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return { x: c.x - 160, y: c.y - 80 }
  }

  const groups: Item[][] = [
    [
      { label: tr('Grupo', 'Group'), icon: SquareDashed, shortcut: '⌘G', key: 'g', onClick: () => addGroup(center()) },
      { label: tr('Nova pasta', 'New folder'), icon: FolderPlus, shortcut: '⌘P', key: 'p', onClick: () => addFolder(center()) },
      { label: tr('Nova conversa', 'New chat'), icon: MessageCirclePlus, shortcut: '⌘N', key: 'n', onClick: () => newLooseConversation() },
      { label: tr('Nota', 'Note'), icon: StickyNote, shortcut: 'C', onClick: () => addNote(center()) }
    ],
    [
      { label: tr('Agentes', 'Agents'), icon: Bot, shortcut: '⇧⌘A', key: 'a', shift: true, onClick: openAgents },
      // No Windows não dá para saber quais servidores um agente abriu (ver devServers.ts).
      ...(IS_WIN
        ? []
        : [{ label: tr('Servidores rodando', 'Running servers'), icon: Server, shortcut: '⇧⌘S', key: 's', shift: true, onClick: openDevServers }]),
      { label: tr('Memória do Claude', 'Claude memory'), icon: Brain, shortcut: '⇧⌘M', key: 'm', shift: true, onClick: () => openMemory() }
    ],
    [{ label: tr('Configurações', 'Settings'), icon: Settings, shortcut: '⌘ ,', onClick: openSettings }]
  ]

  // Os atalhos dos itens valem com o menu fechado. No editor de código a tecla é dele (⌘G é
  // "próximo resultado" da busca).
  const itemsRef = useRef(groups.flat())
  itemsRef.current = groups.flat()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMod(e) || e.altKey || e.repeat) return
      if ((e.target as Element | null)?.closest?.('.cm-editor')) return
      const item = itemsRef.current.find((i) => i.key === e.key.toLowerCase() && !!i.shift === e.shiftKey)
      if (!item) return
      e.preventDefault()
      setOpen(false)
      item.onClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Panel position="top-left" className="!m-0" style={{ top: PANEL_TOP, left: 16 }}>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium shadow-xl shadow-black/40 backdrop-blur-xl ${
            open ? 'bg-fill text-text' : 'bg-surface/90 text-muted hover:text-text'
          }`}
        >
          <Menu size={14} />
          {tr('Menu', 'Menu')}
        </button>
        <Presence kind="menu">
          {open && (
            <div className={`absolute left-0 top-full mt-2.5 w-52 ${MENU_PANEL}`}>
              <MenuArrow side="top" at={20} />
              {groups.map((items, i) => (
                <div key={i}>
                  {i > 0 && <Divider />}
                  {items.map(({ label, icon: Icon, shortcut, onClick }) => (
                    <button
                      key={label}
                      onClick={() => {
                        onClick()
                        setOpen(false)
                      }}
                      className={`group ${MENU_ROW} text-text hover:bg-accent hover:text-white`}
                    >
                      <Icon size={14} />
                      {label}
                      {shortcut && <kbd className="ml-auto font-mono text-faint group-hover:text-white">{keys(shortcut)}</kbd>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Presence>
      </div>
    </Panel>
  )
})
