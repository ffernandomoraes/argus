import { realpath, stat, writeFile } from 'node:fs/promises'
import { writeFileAtomic } from '../lib/atomicWrite'

// Grava um arquivo de texto da pessoa (CLAUDE.md, agente) sem deixá-lo pela metade se o app cair
// no meio. Arquivo que é atalho (dotfiles versionados em outra pasta) continua atalho: grava no
// arquivo de verdade, em vez de trocar o atalho por uma cópia.
export async function writeTextFile(path: string, text: string): Promise<void> {
  const target = await realpath(path).catch(() => path)
  const info = await stat(target).catch(() => null)
  // Link físico (no Windows sem permissão de link simbólico, o CLAUDE.md e o settings.json das
  // contas extras viram um, em accounts/links.ts): o rename trocaria só este nome por um arquivo
  // novo e separaria as cópias. Grava no próprio arquivo, como antes.
  if (info && info.nlink > 1) return writeFile(target, text, 'utf8')
  // O rename leva as permissões do temporário: ele nasce com as do arquivo antigo.
  await writeFileAtomic(target, text, info ? { mode: info.mode & 0o7777 } : {})
}
