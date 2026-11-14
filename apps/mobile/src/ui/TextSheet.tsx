import { useEffect, useRef, useState } from 'react';
import { tr } from '../i18n';
import { Sheet } from './Sheet';

// Gaveta de baixo para escrever um nome (workspace novo, renomear conversa), no lugar da janela
// nativa do navegador. Enter ou o botão confirmam; vazio não confirma.
export function TextSheet({
  open,
  title,
  placeholder,
  initial = '',
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  placeholder?: string
  initial?: string
  confirmLabel: string
  onConfirm: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // Cada abertura começa do valor inicial, com o campo pronto para digitar.
  useEffect(() => {
    if (!open) return;
    setValue(initial);
    const timer = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, initial]);
  const trimmed = value.trim();
  const confirm = () => {
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="done"
          className="w-full rounded-[12px] border border-card-border bg-card px-4 py-3 outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-code py-3 text-[15px] font-semibold active:opacity-60">
            {tr('Cancelar', 'Cancel')}
          </button>
          <button type="submit" disabled={!trimmed} className="flex-1 rounded-full bg-accent py-3 text-[15px] font-semibold text-white active:opacity-60 disabled:opacity-40">
            {confirmLabel}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
