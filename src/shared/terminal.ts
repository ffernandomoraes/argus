export type TerminalOpenRequest = {
  // Uma sessão por conversa: reabrir a mesma conversa reconecta no mesmo processo.
  key: string
  cwd: string
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
