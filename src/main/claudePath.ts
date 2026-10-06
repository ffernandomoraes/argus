import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// App aberto pelo Finder não herda o PATH do terminal; procura nos lugares comuns.
const CANDIDATES = [
  join(homedir(), '.local/bin/claude'),
  join(homedir(), '.claude/local/claude'),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude'
]

export function claudePath(): string {
  return CANDIDATES.find((p) => existsSync(p)) ?? 'claude'
}
