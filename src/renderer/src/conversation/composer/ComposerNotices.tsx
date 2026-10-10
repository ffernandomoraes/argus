import { SYSTEM_SETTINGS } from '../../platform'

type DictationError = { message: string; action?: 'dictation-settings' }

// Avisos embaixo da caixa de escrever: envio que não deu certo e os do ditado (aviso ou erro, com
// o atalho para os ajustes do sistema quando é falta de permissão).
export function ComposerNotices({
  sendError,
  warning,
  error
}: {
  sendError: string | null
  warning: string | null
  error: DictationError | null
}) {
  return (
    <>
      {sendError && <p className="mt-1.5 px-1 text-[12px] text-red-400">{sendError}</p>}
      {warning && !error && <p className="mt-1.5 px-1 text-[12px] text-faint">{warning}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-2 px-1 text-[12px] text-red-400">
          <span>{error.message}</span>
          {error.action === 'dictation-settings' && (
            <button
              onClick={() => window.api.speech.openSettings()}
              className="shrink-0 rounded-md border border-red-400/40 px-1.5 py-0.5 text-red-300 hover:bg-red-500/10"
            >
              Abrir {SYSTEM_SETTINGS}
            </button>
          )}
        </p>
      )}
    </>
  )
}
