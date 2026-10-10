import type { ChatActivity } from '../../../../shared/chat'

// O que o Claude está fazendo agora, no lugar de um "Trabalhando…" parado. Só o tipo da ação:
// o detalhe (comando, arquivo) já aparece na linha da ferramenta logo acima. `foreground`: subagentes
// em primeiro plano, que o Claude está esperando.
export function activityLabel(activity: ChatActivity | undefined, foreground: number): string {
  const tool = activity?.tool
  switch (activity?.kind) {
    case 'thinking':
      return 'Pensando…'
    case 'writing':
      return 'Escrevendo a resposta…'
    case 'preparing':
      return tool === 'Comando' ? 'Montando comando…' : `Montando: ${tool}…`
    case 'running':
      if (foreground) return foreground === 1 ? 'Esperando o subagente…' : `Esperando ${foreground} subagentes…`
      return tool === 'Comando' ? 'Executando comando…' : `Executando: ${tool}…`
    default:
      return 'Trabalhando…'
  }
}
