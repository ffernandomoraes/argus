import type { Design } from '../../shared/design'

// Pastas cuja lista de conversas muda com a gravação de um design. Só o que aparece na lista conta:
// o nome, a conversa, a pasta e se ele entra nela (design novo, ou que passou a ter conversa ou
// tela aberta). Mudar de rota, de porta ou de dispositivo na barra do protótipo grava o design sem
// fazer todas as janelas relerem as pastas e rodarem o git de novo.
export function foldersToRefresh(before: Design | null, after: Design): string[] {
  if (!before) return [after.projectPath].filter(Boolean)
  if (before.projectPath !== after.projectPath) return [before.projectPath, after.projectPath].filter(Boolean)
  const listed = (d: Design) => !!(d.sessionId || d.existing)
  const changed = before.name !== after.name || before.sessionId !== after.sessionId || listed(before) !== listed(after)
  return changed ? [after.projectPath].filter(Boolean) : []
}
