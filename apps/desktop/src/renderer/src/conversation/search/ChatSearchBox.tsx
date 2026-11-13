import { useLayoutEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { IconButton } from '../../ui/IconButton'
import type { ChatSearch } from './useChatSearch'
import { tr } from '../../i18n'

// Caixa da busca na conversa, flutuando no canto de cima, à direita, como no VS Code e no
// navegador: o termo, quantos resultados ("3 de 12"), anterior e próximo, e o X. Enter vai ao
// próximo; Shift+Enter, ao anterior; ESC fecha (useChatSearch).
export function ChatSearchBox({ search }: { search: ChatSearch }) {
  const { query, setQuery, total, current, searching, step, close, focusSignal } = search
  const field = useRef<HTMLInputElement>(null)

  // Aberta (ou ⌘F de novo com ela aberta): o foco volta para o campo, com o termo selecionado.
  useLayoutEffect(() => {
    field.current?.focus({ preventScroll: true })
    field.current?.select()
  }, [focusSignal])

  const count = !query.trim()
    ? ''
    : total
      ? tr(`${current + 1} de ${total}`, `${current + 1} of ${total}`)
      : searching
        ? tr('Buscando…', 'Searching…')
        : tr('Nenhum', 'No results')

  return (
    // nodrag/nopan: no bloco do canvas, digitar e clicar aqui não arrastam nada.
    <div
      role="search"
      onPointerDown={(e) => e.stopPropagation()}
      className="nodrag nopan absolute right-3 top-2 z-20 flex w-[min(340px,calc(100%-1.5rem))] items-center gap-1 rounded-lg border border-line bg-surface-2 py-1 pl-2.5 pr-1 shadow-md shadow-black/20"
    >
      <Search size={14} className="shrink-0 text-faint" />
      <input
        ref={field}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
          e.preventDefault()
          step(e.shiftKey ? -1 : 1)
        }}
        placeholder={tr('Buscar na conversa', 'Search in chat')}
        aria-label={tr('Buscar na conversa', 'Search in chat')}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-text outline-none placeholder:text-faint"
      />
      <span aria-live="polite" className="shrink-0 px-1 text-[13px] tabular-nums text-muted">
        {count}
      </span>
      <IconButton label={tr('Anterior (Shift+Enter)', 'Previous (Shift+Enter)')} size="sm" variant="subtle" disabled={!total} onClick={() => step(-1)}>
        <ChevronUp size={15} />
      </IconButton>
      <IconButton label={tr('Próximo (Enter)', 'Next (Enter)')} size="sm" variant="subtle" disabled={!total} onClick={() => step(1)}>
        <ChevronDown size={15} />
      </IconButton>
      <IconButton label={tr('Fechar busca (Esc)', 'Close search (Esc)')} size="sm" variant="subtle" onClick={close}>
        <X size={14} />
      </IconButton>
    </div>
  )
}
