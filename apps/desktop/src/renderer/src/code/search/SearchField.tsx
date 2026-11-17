import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { tr } from '../../i18n';

// Campo de busca do painel de código (pelo nome e no conteúdo). Com algo digitado, o ESC limpa;
// vazio, segue para fechar o arquivo ou o painel. `children`: botões à direita (opções da busca).
export function SearchField({
  inputRef,
  value,
  onChange,
  onEnter,
  onKeyDown,
  placeholder,
  hint,
  children,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  onKeyDown?: (e: KeyboardEvent) => void
  placeholder: string
  // Atalho mostrado no campo vazio.
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-bg pl-2 pr-1 focus-within:border-line-strong">
      <Search size={13} className="shrink-0 text-faint" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          } else if (e.key === 'Enter' && onEnter && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text outline-none placeholder:text-faint"
      />
      {!value && hint && <kbd className="shrink-0 pr-1 font-sans text-[11px] text-faint">{hint}</kbd>}
      {value && (
        <button aria-label={tr('Limpar busca', 'Clear search')} onClick={() => onChange('')} className="shrink-0 p-0.5 text-faint hover:text-text">
          <X size={13} />
        </button>
      )}
      {children}
    </div>
  );
}
