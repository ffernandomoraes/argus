import { stat } from 'node:fs/promises'
import type { FileDiff } from '../../shared/files'
import type { DiffHunk } from '../../shared/history'
import { noPreview } from '../files/preview'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { insideRoot } from '../paths'
import { gitOutput } from './git'
import { findRepo } from './repo'

// Diff unificado → trechos. O cabeçalho (diff --git, ---, +++) fica de fora, e o
// "\ No newline at end of file" também.
function parseDiff(text: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let hunk: DiffHunk | null = null
  for (const line of text.split('\n')) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (m) {
      hunk = { oldStart: Number(m[1]), newStart: Number(m[2]), lines: [] }
      hunks.push(hunk)
    } else if (hunk && /^[ +-]/.test(line)) hunk.lines.push(line)
  }
  return hunks
}

const BINARY = /^Binary files .* differ$/m
const DIFF_LIMIT = 1_000_000

// Mudanças do arquivo contra o último commit, juntando o que já foi preparado e o que não.
export async function fileDiff(root: string, rel: string): Promise<FileDiff> {
  const file = insideRoot(root, rel)
  if (!file) return { ok: false, error: tr('Caminho fora do projeto.', 'Path is outside the project.') }
  const repo = await findRepo(file)
  if (!repo) return { ok: false, error: tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.') }
  // A tela de diff desenha todas as linhas de uma vez: arquivo grande travaria o app. Arquivo
  // excluído não tem tamanho no disco e segue para o diff.
  const size = (await stat(file).catch(() => null))?.size ?? 0
  const blocked = noPreview(file, size, DIFF_LIMIT, 'diff')
  if (blocked) return { ok: false, error: blocked }
  try {
    const flags = ['--no-optional-locks', 'diff', '--no-color', '--no-ext-diff', '--no-textconv']
    let out = await gitOutput(repo.root, [...flags, 'HEAD', '--', file]).catch(() => '')
    // Vazio: sem mudança, ou arquivo novo (o diff contra o HEAD não vê o que está fora do git).
    if (!out) {
      const untracked = await gitOutput(repo.root, ['ls-files', '--others', '--exclude-standard', '--', file])
      if (untracked.trim()) out = await gitOutput(repo.root, [...flags, '--no-index', '--', '/dev/null', file])
    }
    if (BINARY.test(out)) return { ok: false, error: tr('Arquivo binário, sem diff.', 'Binary file, no diff.') }
    return { ok: true, hunks: parseDiff(out) }
  } catch (err) {
    return { ok: false, error: tr(`Não consegui gerar o diff: ${errorMessage(err)}`, `Couldn’t generate the diff: ${errorMessage(err)}`) }
  }
}
