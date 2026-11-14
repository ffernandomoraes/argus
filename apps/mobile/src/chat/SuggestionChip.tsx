import { tr } from '../i18n';

// Próxima mensagem que o Claude Code prevê ao fim do pedido ("Sim, pode seguir"), em cima da caixa
// de escrever, como no Argus: um toque envia como mensagem sua. Pequena, para não competir com a
// conversa. Fundo na cor do grupo da pasta, como no Argus (cinza sem grupo); o texto fica na cor
// normal, legível também nos grupos de cor clara.
export function SuggestionChip({ text, color, onSend }: { text: string; color?: string; onSend: () => void }) {
  const tint = color || 'var(--muted)';
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 px-2 pb-1.5">
      <span className="shrink-0 text-[11px] text-faint">{tr('Sugestão:', 'Suggestion:')}</span>
      <button
        type="button"
        onClick={onSend}
        aria-label={tr(`Enviar: ${text}`, `Send: ${text}`)}
        className="min-w-0 truncate rounded-full px-2.5 py-1 text-[12px] text-text active:opacity-60"
        style={{ background: `color-mix(in srgb, ${tint} 15%, transparent)` }}
      >
        {text}
      </button>
    </div>
  );
}
