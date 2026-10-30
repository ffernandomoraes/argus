import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tempRoots } from '../tasks/output'
import { diskUsage } from './diskUsage'

// Rascunhos do agente: o Claude Code dá a cada conversa uma pasta temporária
// (<temp>/claude-<uid>/<pasta achatada>/<sessão>/) com o scratchpad (onde o agente clona
// repositórios, instala dependências, gera arquivos), a saída das tarefas e as imagens coladas.
// Ninguém apaga: em 2026-10-30 eram 21 GB, 20 deles de uma conversa só. A pasta de uma conversa
// parada há mais que o prazo sai inteira; a de uma conversa rodando, nunca.

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ScratchSession = { dir: string; sessionId: string; touchedAt: number }

const names = (dir: string) => readdir(dir).catch(() => [] as string[])
const mtimeOf = (path: string) => stat(path).then((s) => s.mtimeMs, () => 0)

// Quando a pasta mudou pela última vez: ela e dois níveis abaixo (scratchpad/, tasks/ e o que tem
// dentro deles). Mais fundo não precisa: um repositório novo no scratchpad já muda o scratchpad.
async function touchedAt(dir: string): Promise<number> {
  let latest = await mtimeOf(dir)
  for (const child of await names(dir)) {
    const path = join(dir, child)
    latest = Math.max(latest, await mtimeOf(path))
    for (const grandchild of await names(path)) latest = Math.max(latest, await mtimeOf(join(path, grandchild)))
  }
  return latest
}

// As pastas temporárias de conversa que existem, de todas as raízes onde o Claude Code grava.
export async function scratchSessions(roots = tempRoots()): Promise<ScratchSession[]> {
  const out: ScratchSession[] = []
  for (const root of roots) {
    for (const project of await names(root)) {
      const projectDir = join(root, project)
      for (const sessionId of await names(projectDir)) {
        if (!SESSION.test(sessionId)) continue
        const dir = join(projectDir, sessionId)
        if (!(await stat(dir).then((s) => s.isDirectory(), () => false))) continue
        out.push({ dir, sessionId, touchedAt: await touchedAt(dir) })
      }
    }
  }
  return out
}

// Apaga as pastas paradas há mais de `days` dias, fora as das conversas rodando (`live`).
export async function cleanScratch(
  days: number,
  live: ReadonlySet<string>,
  now = Date.now(),
  roots = tempRoots()
): Promise<{ removed: number; freedBytes: number }> {
  const limit = now - days * 86_400_000
  let removed = 0
  let freedBytes = 0
  for (const s of await scratchSessions(roots)) {
    if (live.has(s.sessionId) || s.touchedAt > limit) continue
    const size = (await diskUsage(s.dir)) ?? 0
    try {
      await rm(s.dir, { recursive: true, force: true })
      removed++
      freedBytes += size
    } catch (err) {
      console.warn('[armazenamento] não deu para apagar o rascunho', s.dir, err)
    }
  }
  return { removed, freedBytes }
}

// Quanto os rascunhos ocupam, somando as raízes.
export async function scratchUsage(roots = tempRoots()): Promise<{ bytes: number; sessions: number }> {
  let bytes = 0
  for (const root of roots) bytes += (await names(root)).length ? ((await diskUsage(root)) ?? 0) : 0
  return { bytes, sessions: (await scratchSessions(roots)).length }
}
