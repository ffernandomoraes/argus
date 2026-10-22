import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardPaste, Copy, ExternalLink, Link, Scissors } from 'lucide-react'
import type { ClipboardCommand } from '../../../shared/ipc'
import { ContextMenu, type MenuItem, type MenuState } from '../canvas/ContextMenu'
import { tr } from '../i18n'

type Field = HTMLTextAreaElement | HTMLInputElement

// Tipos de <input> que guardam a seleção (selectionStart); os outros (e-mail, número) não.
const TEXT_INPUTS = new Set(['text', 'search', 'url', 'password'])

// Campo de texto sob o clique; nulo fora de um, ou num desligado.
export function fieldAt(target: EventTarget | null): Field | null {
  if (!(target instanceof Element)) return null
  const field = target.closest('textarea, input')
  if (field instanceof HTMLTextAreaElement && !field.disabled) return field
  if (field instanceof HTMLInputElement && !field.disabled && TEXT_INPUTS.has(field.type)) return field
  return null
}

// Texto selecionado sob o botão direito; nulo se não há seleção ou o clique foi fora dela.
function selectedTextAt(target: EventTarget | null): string | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !(target instanceof Node)) return null
  const text = selection.toString()
  if (!text.trim() || !selection.containsNode(target, true)) return null
  return text
}

// Sem "https://", só vale como endereço com um final de site conhecido: "package.json" e
// "index.ts" têm cara de domínio e são nomes de arquivo.
const TLDS = new Set(
  'com net org io app dev br ai co me so sh xyz cloud site tech info gov edu us uk de pt es fr it eu ca link page online store live run fly vercel'.split(' ')
)
const BARE_HOST = /^(localhost|(?:[a-z0-9-]+\.)+([a-z]{2,}))(:\d+)?([/?#]\S*)?$/i

// Endereço da web no texto selecionado (inteiro, sem espaços), com "https://" se faltar.
export function urlIn(text: string): string | null {
  const s = text.trim().replace(/[.,;:!?)\]}>'"]+$/, '')
  if (!s || /\s/.test(s)) return null
  if (/^https?:\/\//i.test(s)) return URL.canParse(s) ? s : null
  const m = BARE_HOST.exec(s)
  if (!m || (m[1] !== 'localhost' && !TLDS.has(m[2].toLowerCase()))) return null
  const url = `${m[1] === 'localhost' ? 'http' : 'https'}://${s}`
  return URL.canParse(url) ? url : null
}

// Abre no navegador: a janela não abre outra; o processo principal manda http(s) para o sistema
// (main/app/navigation.ts).
const openUrl = (url: string) => void window.open(url, '_blank', 'noopener')

const openItem = (url: string): MenuItem => ({
  type: 'action',
  label: tr('Abrir no navegador', 'Open in browser'),
  icon: ExternalLink,
  onSelect: () => openUrl(url)
})

// Recortar, copiar e colar num campo: o foco volta para ele (o clique no menu tirou) e o comando
// nativo age na seleção que ele guardou. O colar nativo passa pelo evento de colar (imagens e
// arquivos no composer).
function fieldItems(field: Field): MenuItem[] {
  const start = field.selectionStart ?? 0
  const end = field.selectionEnd ?? 0
  const selected = field.value.slice(start, end)
  const secret = field instanceof HTMLInputElement && field.type === 'password'
  const run = (command: ClipboardCommand) => () => {
    field.focus()
    window.api.clipboardCommand(command)
  }
  const url = !secret && urlIn(selected)
  const items: MenuItem[] = [
    { type: 'action', label: tr('Recortar', 'Cut'), icon: Scissors, shortcut: '⌘X', disabled: !selected || secret || field.readOnly, onSelect: run('cut') },
    { type: 'action', label: tr('Copiar', 'Copy'), icon: Copy, shortcut: '⌘C', disabled: !selected || secret, onSelect: run('copy') },
    { type: 'action', label: tr('Colar', 'Paste'), icon: ClipboardPaste, shortcut: '⌘V', disabled: field.readOnly, onSelect: run('paste') }
  ]
  return url ? [openItem(url), { type: 'separator' }, ...items] : items
}

// Itens de texto do botão direito: num campo, recortar/copiar/colar; num link da web, abrir no
// navegador e copiar o link; em texto selecionado, copiar (e abrir, se for um endereço). O texto
// é lido na hora do clique: clicar no menu pode desfazer a seleção.
export function textMenuItems(target: EventTarget | null): MenuItem[] {
  const field = fieldAt(target)
  if (field) return fieldItems(field)
  const link = target instanceof Element ? target.closest('a[href]') : null
  const href = link instanceof HTMLAnchorElement && /^https?:$/.test(link.protocol) ? link.href : null
  const text = selectedTextAt(target)
  const url = href ?? (text && urlIn(text))
  const items: MenuItem[] = []
  if (url) items.push(openItem(url))
  if (text) items.push({ type: 'action', label: tr('Copiar', 'Copy'), icon: Copy, shortcut: '⌘C', onSelect: () => void navigator.clipboard.writeText(text) })
  if (href) items.push({ type: 'action', label: tr('Copiar link', 'Copy link'), icon: Link, onSelect: () => void navigator.clipboard.writeText(href) })
  return items
}

// Botão direito em texto onde nenhum outro menu respondeu (o Electron não tem menu próprio). O
// menu dos blocos do canvas põe estes itens no topo do dele (canvas/flow/useMenuHandlers.ts).
export function SelectionMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      const items = textMenuItems(e.target)
      if (!items.length) return
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, items })
    }
    window.addEventListener('contextmenu', onMenu)
    return () => window.removeEventListener('contextmenu', onMenu)
  }, [])

  return menu && createPortal(<ContextMenu menu={menu} onClose={() => setMenu(null)} />, document.body)
}
