import type { ChatActivity } from '../../../../shared/chat'
import { tr } from '../../i18n'

// O que o Claude está fazendo agora, no lugar de um "Trabalhando…" parado. Só o tipo da ação:
// o detalhe (comando, arquivo) já aparece na linha da ferramenta logo acima. `foreground`: subagentes
// em primeiro plano, que o Claude está esperando.
export function activityLabel(activity: ChatActivity | undefined, foreground: number): string {
  const tool = activity?.tool
  // O rótulo vem do processo principal, no idioma da interface.
  const command = tool === 'Comando' || tool === 'Command'
  switch (activity?.kind) {
    case 'thinking':
      return tr('Pensando…', 'Thinking…')
    case 'writing':
      return tr('Escrevendo a resposta…', 'Writing the response…')
    case 'preparing':
      return command ? tr('Montando comando…', 'Preparing command…') : tr(`Montando: ${tool}…`, `Preparing: ${tool}…`)
    case 'running':
      if (foreground) return foreground === 1 ? tr('Esperando o subagente…', 'Waiting for the subagent…') : tr(`Esperando ${foreground} subagentes…`, `Waiting for ${foreground} subagents…`)
      return command ? tr('Executando comando…', 'Running command…') : tr(`Executando: ${tool}…`, `Running: ${tool}…`)
    default:
      return tr('Trabalhando…', 'Working…')
  }
}
