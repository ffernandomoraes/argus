import { useState } from 'react'
import type { UpdateInfo } from '../../../shared/updates'
import { Presence } from '../motion'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useUpdates } from './useUpdates'
import { tr } from '../i18n'

const keepOpen = () => false

// Versão em uso muito atrás da última (ver REQUIRED_BEHIND em updater/index.ts): cobre a janela até
// atualizar, sem fechar pelo Esc nem clicando fora. Só aparece onde a atualização automática
// funciona; se ela der erro no meio, dá para seguir sem atualizar.
export function RequiredUpdateModal() {
  const updates = useUpdates()
  const state = updates?.state
  const required = (state?.status === 'downloading' || state?.status === 'ready') && !!state.required
  // Fica na tela depois de aparecer, também quando o estado passa por "procurando" ou "erro".
  const [shown, setShown] = useState(false)
  if (required && !shown) setShown(true)

  return (
    <Presence kind="modal">{shown && updates && <RequiredUpdateCard updates={updates} onContinue={() => setShown(false)} />}</Presence>
  )
}

function RequiredUpdateCard({ updates, onContinue }: { updates: UpdateInfo; onContinue: () => void }) {
  const { version: current, state } = updates
  const latest = state.status === 'downloading' || state.status === 'ready' ? state.version : null
  // Fora do caminho da atualização (erro no download, por exemplo): não bloqueia mais.
  const failed = state.status !== 'checking' && state.status !== 'downloading' && state.status !== 'ready'

  const status =
    state.status === 'checking'
      ? tr('Procurando a versão nova…', 'Checking for the new version…')
      : state.status === 'downloading'
        ? tr(`Baixando a versão ${state.version} - ${Math.round(state.progress * 100)}%`, `Downloading version ${state.version} - ${Math.round(state.progress * 100)}%`)
        : state.status === 'error' || state.status === 'waiting'
          ? state.message
          : state.status === 'unsupported'
            ? state.reason
            : null

  return (
    <Modal variant="blocking" size="xs" labelledBy="required-update-title" onClose={onContinue} onRequestClose={keepOpen}>
      <div className="px-6 pt-6 pb-5">
        <h1 id="required-update-title" className="text-lg font-semibold text-text">
          {tr('Sua versão está muito desatualizada', 'Your version is very outdated')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {latest
            ? tr(
                `Você está na versão ${current}, e a mais recente é a ${latest}. Atualize para continuar usando o Argus.`,
                `You're on version ${current}, and the latest is ${latest}. Update to keep using Argus.`
              )
            : tr(`Você está na versão ${current}. Atualize para continuar usando o Argus.`, `You're on version ${current}. Update to keep using Argus.`)}
        </p>
        {state.status === 'downloading' && (
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-fill">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
        )}
        {status && <p className="mt-2 text-[13px] text-faint">{status}</p>}
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-line px-6 py-3">
        {failed ? (
          <>
            <Button size="xl" onClick={onContinue}>
              {tr('Continuar sem atualizar', 'Continue without updating')}
            </Button>
            {state.status !== 'unsupported' && (
              <Button size="xl" variant="primary" onClick={() => void window.api.updates.check()}>
                {tr('Tentar de novo', 'Try again')}
              </Button>
            )}
          </>
        ) : (
          <Button
            size="xl"
            variant="primary"
            disabled={state.status !== 'ready'}
            title={state.status === 'ready' ? undefined : tr('Espere o download terminar', 'Wait for the download to finish')}
            onClick={() => window.api.updates.install()}
          >
            {tr('Atualizar agora', 'Update now')}
          </Button>
        )}
      </footer>
    </Modal>
  )
}
