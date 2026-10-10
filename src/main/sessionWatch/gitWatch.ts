import { unwatchFile, watchFile, type Stats } from 'node:fs'
import { join } from 'node:path'
import { IS_WIN } from '../platform'
import { watchDir } from './watchDir'

export type GitWatch = { close(): void }

// No Windows, vigiar a pasta .git deixa um handle aberto dentro do projeto, e o Explorer não
// consegue renomear a pasta do projeto. Lá a data de HEAD, index e logs/HEAD é conferida a cada
// segundo, sem nada aberto: juntos eles mudam em checkout, commit, add, reset, stash e troca de
// nome da branch (conferido com o git 2.x).
const POLL_MS = 1000
const POLLED = ['HEAD', 'index', join('logs', 'HEAD')]

// A branch e os arquivos não comitados mudam junto com um checkout, um add ou um commit.
export function watchGit(gitDir: string, onChange: () => void, onError: () => void): GitWatch | null {
  return IS_WIN ? pollGit(gitDir, onChange) : watchGitDir(gitDir, onChange, onError)
}

// O git troca HEAD e index gravando um .lock e renomeando; o resto da pasta .git não interessa.
function watchGitDir(gitDir: string, onChange: () => void, onError: () => void): GitWatch | null {
  return watchDir(
    gitDir,
    (file) => {
      if (file?.startsWith('HEAD') || file?.startsWith('index')) onChange()
    },
    onError
  )
}

function pollGit(gitDir: string, onChange: () => void): GitWatch {
  const files = POLLED.map((f) => join(gitDir, f))
  const listener = (now: Stats, before: Stats) => {
    if (now.mtimeMs !== before.mtimeMs || now.size !== before.size || now.ino !== before.ino) onChange()
  }
  for (const file of files) watchFile(file, { interval: POLL_MS }, listener)
  return { close: () => files.forEach((file) => unwatchFile(file, listener)) }
}
