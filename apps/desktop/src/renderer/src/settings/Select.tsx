import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Presence } from '../motion';
import { useEscape } from '../useEscape';
import { useOutsideClick } from '../useOutsideClick';

export type SelectOption<T extends string> = {
  value: T
  label: string
  // Antes do texto, no campo e na lista (ex.: o ícone do modo).
  leading?: ReactNode
  // Título do grupo. Opções seguidas com o mesmo `group` ficam juntas, sob o título (ex.: a família
  // do modelo). Sem `group`: solta, sem título.
  group?: string
  // Texto em vermelho (ex.: "Ignorar permissões").
  danger?: boolean
};

// Altura máxima da lista aberta (max-h-72) e da linha, para decidir se abre para cima.
const LIST_MAX_HEIGHT = 288;
const ROW_HEIGHT = 32;

// Espaço livre acima e abaixo do botão, dentro da área que rola em volta (a página das
// Configurações) ou da janela. A lista abre para onde couber, para não ser cortada.
function spaceAround(el: HTMLElement): { above: number; below: number } {
  const rect = el.getBoundingClientRect();
  let top = 0;
  let bottom = window.innerHeight;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowY === 'visible') continue;
    const box = parent.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
    break;
  }
  return { above: rect.top - top, below: bottom - rect.bottom };
}

// Campo de escolha com a lista desenhada pelo app, no tema (o <select> nativo abria a lista do
// sistema), como o do Head Desk. Teclado: setas, Home/End, Enter ou espaço escolhe, Esc fecha (só a
// lista, não o painel em volta); o foco fica no botão.
export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  label,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  // Nome para leitor de tela (o rótulo à vista fica na linha, fora do campo).
  label?: string
}) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const optionId = (index: number) => `${id}-option-${index}`;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  useOutsideClick(root, () => setOpen(false), open);
  useEscape(() => setOpen(false), open);

  // A opção ativa fica à vista quando a lista rola.
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  });

  const openList = () => {
    if (button.current) {
      const space = spaceAround(button.current);
      const groups = new Set(options.map((option) => option.group).filter(Boolean)).size;
      const height = Math.min(LIST_MAX_HEIGHT, (options.length + groups) * ROW_HEIGHT + 16);
      setUpward(space.below < height && space.above > space.below);
    }
    setActive(selectedIndex);
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(last, active + 1),
      ArrowUp: () => Math.max(0, active - 1),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative min-w-0">
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex h-9 w-full min-w-44 items-center gap-2 rounded-lg border bg-fill px-3 text-left text-[15px] outline-none transition-[border-color,box-shadow] disabled:opacity-40 ${
          open ? 'border-accent ring-2 ring-accent/20' : 'border-line enabled:hover:border-line-strong focus-visible:border-accent'
        } ${selected?.danger ? 'text-red-400' : 'text-text'}`}
      >
        {selected?.leading}
        <span className="min-w-0 flex-1 truncate" title={selected?.label}>
          {selected?.label}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <Presence kind="menu">
        {open && (
          <OptionList
            id={id}
            options={options}
            active={active}
            selected={selectedIndex}
            upward={upward}
            optionId={optionId}
            onHover={setActive}
            onChoose={choose}
          />
        )}
      </Presence>
    </div>
  );
}

// Lista aberta. `active` = opção sob o mouse ou as setas; `selected` = a escolhida.
function OptionList<T extends string>({
  id,
  options,
  active,
  selected,
  upward,
  optionId,
  onHover,
  onChoose,
}: {
  id: string
  options: SelectOption<T>[]
  active: number
  selected: number
  upward: boolean
  optionId: (index: number) => string
  onHover: (index: number) => void
  onChoose: (index: number) => void
}) {
  return (
    <ul
      id={`${id}-list`}
      role="listbox"
      className={`absolute right-0 z-40 max-h-72 w-full min-w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/40 ${
        upward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      }`}
    >
      {options.map((option, index) => {
        const startsGroup = !!option.group && option.group !== options[index - 1]?.group;
        return (
          <li key={option.value} role="presentation">
            {startsGroup && (
              <div className={`px-2.5 pb-1 pt-1.5 text-[15px] text-faint ${index > 0 ? 'mt-1.5 border-t border-line' : ''}`}>{option.group}</div>
            )}
            <div
              id={optionId(index)}
              role="option"
              aria-selected={index === selected}
              title={option.label}
              onMouseEnter={() => onHover(index)}
              // Sem roubar o foco do botão (o teclado continua funcionando).
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChoose(index)}
              className={`flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[15px] ${index === active ? 'bg-surface-2' : ''} ${
                index === selected ? 'font-medium' : ''
              } ${option.danger ? 'text-red-400' : 'text-text'}`}
            >
              {option.leading}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {index === selected && <Check size={14} className="shrink-0 text-accent" aria-hidden="true" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
