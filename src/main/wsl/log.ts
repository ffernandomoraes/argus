// Registro do que o app pediu ao WSL e do que voltou. Sem um Windows com WSL para testar, é por
// ele que dá para entender um problema: as configurações copiam o texto (ver diagnostics.ts).
const MAX = 200
const lines: string[] = []

export function log(what: string, detail?: string): void {
  const line = `${new Date().toISOString()} ${what}${detail ? `: ${detail}` : ''}`
  lines.push(line)
  if (lines.length > MAX) lines.shift()
  console.log('[wsl]', line)
}

export const logLines = (): string[] => [...lines]
