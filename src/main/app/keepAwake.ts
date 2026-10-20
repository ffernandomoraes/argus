import { powerSaveBlocker } from 'electron'
import type { ChatEntry } from '../chats/entries'

// Com um agente trabalhando, o computador não dorme sozinho por ficar parado: dormir no meio deixa
// a tarefa parada até alguém acordar a máquina. Solta assim que nada mais trabalha.
// `prevent-app-suspension` segura só o repouso por inatividade: a tela apaga normalmente, e fechar a
// tampa do notebook continua pondo o computador para dormir (nenhum app consegue impedir isso).
// Bateria no fim e superaquecimento ficam com o sistema, que põe para dormir mesmo assim.

// Terminais: o status do `claude` só está no arquivo que ele grava (ver liveSessions.ts), e nenhum
// aviso chega aqui quando ele muda (nem quando um terminal abre): confere de tempos em tempos. Sem
// terminal do `claude` aberto, a conferência não lê nada. O sistema leva minutos para dormir por
// inatividade, então meio minuto de atraso não faz diferença.
const TERMINAL_CHECK_MS = 30_000

type Sources = {
  chats: () => ChatEntry[]
  // Algum `claude` de terminal trabalhando agora; nulo se não há terminal para conferir.
  terminalsWorking: () => boolean | null
}

// Trabalhando: respondendo, ou com subagente ou comando em segundo plano. Esperando você não conta:
// parado aguardando resposta, o computador pode dormir.
const chatWorking = (c: ChatEntry) => c.state.status === 'running' || c.state.agents.length > 0

export class KeepAwake {
  private blocker: number | null = null
  // Última conferência dos terminais: a conversa muda de estado a cada pedaço de texto que chega, e
  // reler os arquivos de status a cada um pesaria à toa.
  private terminals = false

  constructor(private sources: Sources) {
    setInterval(() => {
      this.terminals = this.sources.terminalsWorking() === true
      this.refresh()
    }, TERMINAL_CHECK_MS).unref()
  }

  // Chamado a cada mudança de estado de uma conversa e a cada conferência dos terminais.
  refresh = (): void => {
    this.hold(this.terminals || this.sources.chats().some(chatWorking))
  }

  private hold(working: boolean): void {
    const holding = this.blocker !== null && powerSaveBlocker.isStarted(this.blocker)
    if (working && !holding) this.blocker = powerSaveBlocker.start('prevent-app-suspension')
    else if (!working && holding) {
      powerSaveBlocker.stop(this.blocker!)
      this.blocker = null
    }
  }
}
