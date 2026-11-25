import { tr } from '../i18n';
import { Sheet } from './Sheet';

// Gaveta de baixo para confirmar uma ação (esquecer o computador, desconectar), no lugar da janela
// nativa do navegador. danger: o botão de confirmar em vermelho. onCancel: recusar (Cancelar ou tocar
// fora) faz algo além de fechar a gaveta; sem ele, recusar só fecha.
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  danger,
  above,
  onConfirm,
  onClose,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  above?: boolean
  onConfirm: () => void
  onClose: () => void
  onCancel?: () => void
}) {
  const cancel = onCancel ?? onClose;
  return (
    <Sheet open={open} onClose={cancel} title={title} above={above}>
      {message && <p className="mb-4 text-center text-[14px] leading-snug text-muted">{message}</p>}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            onClose();
            onConfirm();
          }}
          className={`w-full rounded-full py-3 text-[15px] font-semibold active:opacity-60 ${danger ? 'bg-red text-white' : 'bg-accent text-white'}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={cancel} className="w-full rounded-full bg-code py-3 text-[15px] font-semibold active:opacity-60">
          {tr('Cancelar', 'Cancel')}
        </button>
      </div>
    </Sheet>
  );
}
