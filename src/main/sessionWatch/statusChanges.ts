import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LiveStatus } from '../../shared/history'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// Sessões que entraram, saíram ou mudaram de status entre duas leituras.
export function changedSessions(before: ReadonlyMap<string, LiveStatus>, now: ReadonlyMap<string, LiveStatus>): string[] {
  const out: string[] = []
  for (const [id, status] of now) if (before.get(id) !== status) out.push(id)
  for (const id of before.keys()) if (!now.has(id)) out.push(id)
  return out
}

// Das pastas vigiadas, as que têm a conversa de algum desses ids. O arquivo de status não diz a
// pasta: quem diz é o .jsonl da sessão, dentro da pasta de conversas do projeto.
export function projectsWith(ids: readonly string[], paths: Iterable<string>): string[] {
  const valid = ids.filter(isSessionId)
  const out: string[] = []
  if (!valid.length) return out
  for (const path of paths) {
    const dir = projectDir(path)
    if (valid.some((id) => existsSync(join(dir, `${id}.jsonl`)))) out.push(path)
  }
  return out
}
