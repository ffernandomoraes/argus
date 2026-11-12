import { Presence } from './motion'
import { REMOTE_HOST, useRemoteState } from './remote'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { tr } from './i18n'

const keepOpen = () => false

// Janela de acesso remoto sem ligação: cobre tudo, porque nada do que aparece atrás está
// atualizado e nenhum clique chega ao outro computador. Reconectando, some sozinho quando a
// ligação volta (a janela recarrega).
export function RemoteLostModal() {
  const state = useRemoteState()
  const name = REMOTE_HOST?.name ?? ''
  const reconnecting = state === 'reconnecting'
  return (
    <Presence kind="modal">
      {state !== 'connected' && (
        <Modal variant="blocking" size="xs" labelledBy="remote-lost-title" onClose={() => window.close()} onRequestClose={keepOpen}>
          <div className="px-6 pt-6 pb-5">
            <h1 id="remote-lost-title" className="text-lg font-semibold text-text">
              {reconnecting ? tr('Reconectando…', 'Reconnecting…') : tr('A ligação acabou', 'The connection ended')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {reconnecting
                ? tr(
                    `A ligação com ${name} caiu. Tentando de novo; o que estava rodando lá continua rodando.`,
                    `The connection to ${name} dropped. Trying again; what was running there keeps running.`
                  )
                : tr(
                    `Esta janela não está mais ligada ao Argus de ${name}. O que estava rodando lá continua rodando. Para voltar, abra de novo em Configurações > Acesso remoto.`,
                    `This window is no longer connected to Argus on ${name}. What was running there keeps running. To come back, open it again in Settings > Remote access.`
                  )}
            </p>
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-line px-6 py-3">
            <Button size="xl" variant={reconnecting ? 'secondary' : 'primary'} onClick={() => window.close()}>
              {tr('Fechar janela', 'Close window')}
            </Button>
          </footer>
        </Modal>
      )}
    </Presence>
  )
}
