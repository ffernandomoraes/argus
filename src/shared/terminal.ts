export type TerminalOpenRequest = {
  // Uma sessão por conversa: reabrir a mesma conversa reconecta no mesmo processo.
  key: string
  cwd: string
  // Shell do sistema (zsh) em vez do `claude`; os campos do Claude abaixo não valem.
  shell?: boolean
  // Conta do Claude do grupo onde o terminal está; vazia = a padrão. Vale também para o
  // `claude` digitado no shell.
  account?: string
  // ID da sessão do Claude Code; com ele o terminal abre com `claude --resume <id>`.
  sessionId?: string
  // Só valem ao abrir; numa sessão já aberta a troca vai como /model e /effort.
  model?: string
  effort?: string
  // JSON para --settings (thinking, Ultracode).
  settingsJson?: string
  permissionMode?: string
  cols: number
  rows: number
}

export type TerminalOpenResult = { ok: true; buffer: string } | { ok: false; error: string }
