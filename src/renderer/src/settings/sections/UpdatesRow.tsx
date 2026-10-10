import type { UpdateState } from '../../../../shared/updates'
import { Button } from '../../ui/Button'
import { useUpdates } from '../../updates/useUpdates'
import { Row } from '../controls'

function statusText(state: UpdateState): string {
  switch (state.status) {
    case 'checking':
      return 'Procurando versão nova…'
    case 'latest':
      return 'Você está na versão mais recente.'
    case 'downloading':
      return `Baixando a versão ${state.version} - ${Math.round(state.progress * 100)}%.`
    case 'ready':
      return `A versão ${state.version} está pronta: entra ao reiniciar ou quando o app fechar.`
    // Windows: a versão nova saiu, mas o instalador ainda não subiu (não é erro).
    case 'waiting':
    case 'error':
      return state.message
    case 'unsupported':
      return state.reason
    default:
      return 'Procura versão nova ao abrir o app e a cada 5 horas.'
  }
}

// A conferência automática roda sozinha (ao abrir e a cada 5 horas); aqui dá para forçar.
export function UpdatesRow() {
  const updates = useUpdates()
  if (!updates) return null
  const { version, state } = updates
  const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'unsupported'

  return (
    <Row label="Atualizações" description={`Versão ${version}. ${statusText(state)}`}>
      {state.status === 'ready' ? (
        <Button onClick={() => window.api.updates.install()}>Reiniciar e atualizar</Button>
      ) : (
        <Button disabled={busy} onClick={() => void window.api.updates.check()}>
          Procurar
        </Button>
      )}
    </Row>
  )
}
