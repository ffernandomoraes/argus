import { createHash } from 'node:crypto'
import { userInfo } from 'node:os'

// Item das Chaves do macOS onde o Claude Code guarda o login, com o mesmo nome que ele dá
// (conferido na 2.1.295): "Claude Code-credentials" na principal e, com CLAUDE_CONFIG_DIR, mais
// "-" e os 8 primeiros caracteres do sha256 da pasta.
export function keychainService(dir?: string): string {
  const base = 'Claude Code-credentials'
  if (!dir) return base
  return `${base}-${createHash('sha256').update(dir.normalize('NFC')).digest('hex').slice(0, 8)}`
}

// Conta do item, também como o Claude Code grava: o usuário do sistema ou, com caracteres fora do
// comum no nome, um nome fixo.
export function keychainAccount(): string {
  let user: string
  try {
    user = process.env.USER || userInfo().username
  } catch {
    return 'claude-code-user'
  }
  return /^[a-zA-Z0-9._-]+$/.test(user) ? user : 'claude-code-user'
}
