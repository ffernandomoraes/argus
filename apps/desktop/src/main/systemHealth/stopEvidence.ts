import { firstCause, type StopCause, type StopKind } from '../chats/messages'
import { stoppedPidOf } from '../liveSessions'
import { IS_MAC, IS_WIN } from '../platform'
import { jetsamKill } from './jetsam'
import { lowMemoryLogged } from './windowsEvents'

// Por que o Claude parou, com a confirmação do próprio sistema: só diz "falta de memória" quando o
// macOS registrou que matou o processo por isso (o relatório de jetsam, com o pid dele) ou quando o
// Windows registrou a memória virtual acabando na hora da queda. Sem confirmação, fica o que a
// mensagem do processo diz (ver stopKind em chats/messages.ts). Linux e WSL: sem confirmação.

// O aviso de memória baixa do Windows conta se saiu até este tempo antes da queda.
const WINDOWS_WINDOW_MS = 5 * 60_000

export async function confirmStopCause(kind: StopKind, sessionId: string | undefined, at: number): Promise<StopCause> {
  if (kind !== 'killed' && kind !== 'oom') return firstCause(kind)
  if (IS_MAC && sessionId) {
    const pid = await stoppedPidOf(sessionId)
    const cause = pid ? await jetsamKill(pid, at) : null
    if (cause) return cause
  }
  if (IS_WIN && kind === 'oom' && (await lowMemoryLogged(Date.now() - at + WINDOWS_WINDOW_MS))) return 'memory'
  return kind
}
