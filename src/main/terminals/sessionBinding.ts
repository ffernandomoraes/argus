import { existsSync } from 'node:fs'
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
  // A conversa já foi gravada na pasta de conversas de `cwd`?
  saved(cwd: string, sessionId: string): boolean
}

const diskLookup: SessionLookup = {
  sessionOf: sessionIdByPid,
  saved: (cwd, sessionId) => {
    const file = sessionFile(cwd, sessionId)
    return !!file && existsSync(file)
  }
}

// Consulta a cada `every` ms até achar a conversa gravada; chama onFound uma vez. Devolve como
// parar (o terminal fechou ou saiu antes).
export function watchSession(
  pid: number,
  cwd: string,
  onFound: (sessionId: string) => void,
  lookup: SessionLookup = diskLookup,
  every = POLL_MS
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const check = () => {
    timer = null
    const id = lookup.sessionOf(pid)
    if (id && lookup.saved(cwd, id)) return onFound(id)
    timer = setTimeout(check, every)
  }
  timer = setTimeout(check, every)
  return () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
}
