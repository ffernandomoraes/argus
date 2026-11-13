import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// O Claude Code grava cada subagente num arquivo próprio, ao lado da conversa que o lançou:
// <pasta do projeto>/<sessão>/subagents/agent-<id>.jsonl, com um agent-<id>.meta.json que diz
// qual chamada da ferramenta Agent o lançou (toolUseId). O meta nasce junto com o subagente.
const META = '.meta.json'

// Achados ficam guardados: o arquivo de um subagente não muda de lugar.
const found = new Map<string, string>()

// Arquivo do subagente lançado pela chamada `toolUseId` na sessão; nulo se (ainda) não existe.
export async function subagentFile(projectPath: string, sessionId: unknown, toolUseId: unknown): Promise<string | null> {
  if (!isSessionId(sessionId) || !isSessionId(toolUseId)) return null
  const dir = join(projectDir(projectPath), sessionId, 'subagents')
  const key = `${dir}\0${toolUseId}`
  const hit = found.get(key)
  if (hit) return hit
  const names = await readdir(dir).catch(() => [] as string[])
  for (const name of names) {
    if (!name.endsWith(META)) continue
    const meta = await readFile(join(dir, name), 'utf8').then(JSON.parse, () => null)
    if (meta?.toolUseId !== toolUseId) continue
    const file = join(dir, name.slice(0, -META.length) + '.jsonl')
    found.set(key, file)
    return file
  }
  return null
}
