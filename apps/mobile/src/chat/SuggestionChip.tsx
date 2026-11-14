import { tr } from '../i18n';

// Próxima mensagem que o Claude Code prevê ao fim do pedido ("Sim, pode seguir"), em cima da caixa
// de escrever, como no Argus: um toque envia como mensagem sua. Pequena, para não competir com a
// conversa.
export function SuggestionChip({ text, onSend }: { text: string; onSend: () => void }) {
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 px-2 pb-1.5">
      <span className="shrink-0 text-[11px] text-faint">{tr('Sugestão:', 'Suggestion:')}</span>
      <button
        type="button"
        onClick={onSend}
        aria-label={tr(`Enviar: ${text}`, `Send: ${text}`)}
        className="min-w-0 truncate rounded-full border border-line bg-card px-2.5 py-1 text-[12px] active:opacity-60"
      >
        {text}
      </button>
    </div>
  );
}
