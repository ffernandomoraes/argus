import type { ReactNode } from 'react';

export type TabOption<T extends string> = { value: T; label: string; icon?: ReactNode };

// Abas internas de uma seção das Configurações: os nomes lado a lado sobre uma linha, e a aba aberta
// sublinhada na cor de destaque. Para dividir uma seção em partes (o Segmented é para escolher um
// valor).
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: TabOption<T>[]
  onChange: (value: T) => void
  // Nome do grupo de abas para leitor de tela.
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-2 flex gap-6 border-b border-line">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-[15px] transition-colors ${
              selected ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
