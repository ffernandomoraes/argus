import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Message } from '../../types';
import { tr } from '../../../i18n';

// Raciocínio do Claude, no estilo da linha de comando (BashRow): uma linha só, "Pensou por 4s" e o
// começo do raciocínio cortado com "…", a seta no fim; o clique abre o texto inteiro.
export const ThinkingRow = memo(function ThinkingRow({ message }: { message: Extract<Message, { role: 'thinking' }> }) {
  const [open, setOpen] = useState(false);
  const label = message.seconds && message.seconds > 0 ? tr(`Pensou por ${message.seconds}s`, `Thought for ${message.seconds}s`) : tr('Pensou um pouco', 'Thought briefly');
  const preview = message.text.replace(/\s+/g, ' ').trim();
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2 py-1 text-left leading-5 text-muted hover:text-text"
      >
        <span className="shrink-0 font-medium text-text">{label}</span>
        <span className="truncate text-muted">{preview}</span>
        <ChevronRight size={13} className={`ml-auto shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      {/* Arrastar para copiar um trecho não conta como clique. */}
      {open && (
        <div
          onClick={() => !window.getSelection()?.toString() && setOpen(false)}
          className="mt-1 max-h-72 cursor-pointer overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] leading-relaxed text-muted"
        >
          {message.text}
        </div>
      )}
    </div>
  );
});
