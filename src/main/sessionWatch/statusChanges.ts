import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { LiveStatus } from '../../shared/history'
import { withTimeout } from '../lib/timeout'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// Sem resposta da pasta nesse tempo (a do WSL travado), ela fica de fora deste aviso: as outras
// pastas não esperam por ela.
const ANSWER_MS = 5000

// Sessões que entraram, saíram ou mudaram de status entre duas leituras.
export function changedSessions(before: ReadonlyMap<string, LiveStatus>, now: ReadonlyMap<string, LiveStatus>): string[] {
  const out: string[] = []
  for (const [id, status] of now) if (before.get(id) !== status) out.push(id)
  for (const id of before.keys()) if (!now.has(id)) out.push(id)
  return out
}

// Das pastas vigiadas, as que têm a conversa de algum desses ids. O arquivo de status não diz a
// pasta: quem diz é o .jsonl da sessão, dentro da pasta de conversas do projeto. Conferido sem
// segurar o app: roda a cada mudança de status de qualquer Claude Code aberto, e no WSL cada
// conferência atravessa a rede até o Linux (2026-10-23).
export async function projectsWith(ids: readonly string[], paths: Iterable<string>): Promise<string[]> {
  const valid = ids.filter(isSessionId)
  if (!valid.length) return []
  const list = [...paths]
  const hits = await Promise.all(list.map((path) => withTimeout(holdsAny(projectDir(path), valid), ANSWER_MS, false)))
  return list.filter((_, i) => hits[i])
}

async function holdsAny(dir: string, ids: readonly string[]): Promise<boolean> {
  const found = await Promise.all(
    ids.map((id) =>
      access(join(dir, `${id}.jsonl`)).then(
        () => true,
        () => false
      )
    )
  )
  return found.includes(true)
}
