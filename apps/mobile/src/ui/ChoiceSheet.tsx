import { Check } from 'lucide-react';
import { Sheet } from './Sheet';

// Gaveta de escolher uma opção (idioma, tema...), com a marca na escolhida.
export function ChoiceSheet<T extends string>({
  open,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  options: { value: T; label: string }[]
  value: T
  onPick: (value: T) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onPick(o.value);
              onClose();
            }}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-[13px] text-left last:border-0 active:bg-card-press"
          >
            <span className="flex-1 text-[15px]">{o.label}</span>
            {o.value === value && <Check size={18} className="shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
