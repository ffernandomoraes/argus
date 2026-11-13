import { useRef } from 'react';
import { tr } from '../../i18n';

// Título da conversa virando campo para renomear: nasce com o foco e o texto selecionado. Enter ou
// clicar fora guarda; Esc cancela (sem fechar o drawer). Nome vazio ou igual não muda nada.
export function TitleField({ value, onDone }: { value: string; onDone: (title: string | null) => void }) {
  const done = useRef(false);
  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    const title = text?.trim();
    onDone(title && title !== value ? title : null);
  };

  return (
    <input
      autoFocus
      defaultValue={value}
      spellCheck={false}
      aria-label={tr('Nome da conversa', 'Chat name')}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        // Sem subir: os atalhos do canvas e do drawer não valem enquanto digita o nome.
        e.stopPropagation();
        // Compondo um acento ou um ideograma (IME), Enter e Esc são da composição.
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') finish(e.currentTarget.value);
        else if (e.key === 'Escape') {
          // preventDefault: o Esc só cancela, não fecha o drawer (ver useEscape).
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="no-drag nodrag nopan min-w-0 flex-1 rounded border border-accent bg-bg px-1.5 py-0.5 font-medium text-text outline-none"
    />
  );
}
