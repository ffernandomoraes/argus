import type { UpdateState } from '../../../../shared/updates'
import { Button } from '../../ui/Button'
import { useUpdates } from '../../updates/useUpdates'
import { Row } from '../controls'
import { tr } from '../../i18n'

function statusText(state: UpdateState): string {
  switch (state.status) {
    case 'checking':
      return tr('Procurando versão nova…', 'Checking for a new version…')
    case 'latest':
      return tr('Você está na versão mais recente.', 'You are on the latest version.')
    case 'downloading':
      return tr(
        `Baixando a versão ${state.version} - ${Math.round(state.progress * 100)}%.`,
        `Downloading version ${state.version} - ${Math.round(state.progress * 100)}%.`
      )
    case 'ready':
      return tr(
        `A versão ${state.version} está pronta: entra ao reiniciar ou quando o app fechar.`,
        `Version ${state.version} is ready: it installs when you restart or when the app quits.`
      )
    // Windows: a versão nova saiu, mas o instalador ainda não subiu (não é erro).
    case 'waiting':
    case 'error':
      return state.message
    case 'unsupported':
      return state.reason
    default:
      return tr('Procura versão nova ao abrir o app e a cada 5 horas.', 'Checks for a new version when the app opens and every 5 hours.')
  }
}

// A conferência automática roda sozinha (ao abrir e a cada 5 horas); aqui dá para forçar.
export function UpdatesRow() {
  const updates = useUpdates()
  if (!updates) return null
  const { version, state } = updates
  const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'unsupported'

  return (
    <Row label={tr('Atualizações', 'Updates')} description={tr(`Versão ${version}. ${statusText(state)}`, `Version ${version}. ${statusText(state)}`)}>
      {state.status === 'ready' ? (
        <Button onClick={() => window.api.updates.install()}>{tr('Reiniciar e atualizar', 'Restart and update')}</Button>
      ) : (
        <Button disabled={busy} onClick={() => void window.api.updates.check()}>
          {tr('Procurar', 'Check')}
        </Button>
      )}
    </Row>
  )
}
