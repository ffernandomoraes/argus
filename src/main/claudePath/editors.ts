import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IS_WIN } from '../platform'

// A extensão do Claude Code para o VS Code (e para os editores feitos a partir dele) traz um
// `claude` próprio, que o editor atualiza sozinho. Quem não atualiza o do terminal costuma ter um
// mais novo aqui. Uma pasta por versão da extensão; as antigas somem depois de um tempo.
const EDITOR_DIRS = ['.vscode', '.vscode-insiders', '.cursor', '.windsurf']
const EXTENSION_PREFIX = 'anthropic.claude-code-'

export function editorClaudes(): string[] {
  const home = homedir()
  const binary = IS_WIN ? 'claude.exe' : 'claude'
  return EDITOR_DIRS.flatMap((editor) => {
    const root = join(home, editor, 'extensions')
    let entries: string[]
    try {
      entries = readdirSync(root)
    } catch {
      return []
    }
    return entries
      .filter((name) => name.startsWith(EXTENSION_PREFIX))
      .map((name) => join(root, name, 'resources', 'native-binary', binary))
      .filter((p) => existsSync(p))
  })
}
