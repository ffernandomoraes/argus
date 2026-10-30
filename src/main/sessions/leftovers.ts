import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { accountIds } from '../accounts'
import { configDir } from '../claudeHome'
import { tempRoots } from '../tasks/output'
import { isSessionId } from '../transcripts/projectDir'

// O que o Claude Code guarda de uma conversa fora do .jsonl: os rascunhos do agente (a pasta
// temporária <temp>/claude-<uid>/<projeto>/<sessão>/, com o scratchpad, a saída das tarefas e as
// imagens coladas), os pontos de restauração dos arquivos que ele editou (file-history/<sessão>) e
// o ambiente do shell (session-env/<sessão>). Excluir a conversa leva tudo junto, de vez: não vai
// para a Lixeira (um rascunho chegou a 20 GB). Essas pastas são de cada conta (não são ligadas à
// principal; ver accounts/links.ts).

const configDirs = () => [...new Set(accountIds().map((account) => configDir(account)))]

export async function removeSessionLeftovers(id: string, roots = tempRoots(), configs = configDirs()): Promise<void> {
  if (!isSessionId(id)) return
  const targets: string[] = []
  // A pasta temporária fica dentro da do projeto (o caminho achatado): procura em todas, sem
  // depender de como o Claude Code achatou o caminho.
  for (const root of roots) {
    for (const project of await readdir(root).catch(() => [] as string[])) targets.push(join(root, project, id))
  }
  for (const dir of configs) targets.push(join(dir, 'file-history', id), join(dir, 'session-env', id))
  await Promise.all(
    targets.map((path) => rm(path, { recursive: true, force: true }).catch((err: unknown) => console.warn('[conversas] não deu para apagar', path, err)))
  )
}
