import { access } from 'node:fs/promises'
import { sessionIdByPid } from '../liveSessions'
import { sessionFile } from '../transcripts/projectDir'

// O `claude` aberto no terminal sem conversa cria a dele e não diz qual é. Mas todo Claude Code
// grava <conta>/sessions/<pid>.json com o id da sessão (ver liveSessions.ts), e o terminal sabe o
// pid do processo: dá para amarrar sem adivinhar pela pasta (que pegava a conversa nova aberta no
// drawer). O id já aparece no arquivo na abertura, mas a conversa só existe no disco depois da
// primeira mensagem: amarrar antes faria o `--resume` da próxima abertura falhar. Por isso a
// consulta espera também o .jsonl da sessão na pasta de conversas do projeto.
const POLL_MS = 1000

export type SessionLookup = {
  // Sessão do processo; nula se ele ainda não gravou o status (ou já saiu).
  sessionOf(pid: number): string | null
  // A conversa já foi gravada na pasta de conversas de `cwd`? Sem segurar o app: no WSL a pasta é
  // de rede (\\wsl.localhost\...), e a conferência síncrona, a cada segundo, travava tudo sempre que
  // a máquina virtual demorava a responder.
  saved(cwd: string, sessionId: string): Promise<boolean>
}

export const diskLookup: SessionLookup = {
  sessionOf: sessionIdByPid,
  saved: async (cwd, sessionId) => {
    const file = sessionFile(cwd, sessionId)
    if (!file) return false
    return access(file).then(
      () => true,
      () => false
    )
  }
}

// Consulta a cada `every` ms até achar a conversa gravada; chama onFound uma vez. Devolve como
// parar (o terminal fechou ou saiu antes). A próxima consulta só começa quando a anterior responde.
export function watchSession(
  pid: number,
  cwd: string,
  onFound: (sessionId: string) => void,
  lookup: SessionLookup = diskLookup,
  every = POLL_MS
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  const check = async () => {
    timer = null
    const id = lookup.sessionOf(pid)
    const found = id ? await lookup.saved(cwd, id).catch(() => false) : false
    // Parado enquanto a resposta não vinha: o terminal já fechou.
    if (stopped) return
    if (id && found) return onFound(id)
    timer = setTimeout(() => void check(), every)
  }
  timer = setTimeout(() => void check(), every)
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
  }
}
