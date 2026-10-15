import type { ProviderId } from '../shared/providers'
import { expandHome } from './paths'

// Workspace: as pastas dele entram como pastas adicionais de cada agente, que abre na pasta do
// workspace (ver workspaces.ts) (conferido no --help de cada CLI: claude 2.1, codex 0.162, gemini 0.64, cursor-agent).
// `dir` converte o caminho para o que o agente enxerga (no WSL, o caminho do Linux).
export function folderArgs(agent: 'claude' | ProviderId, folders: string[] = [], dir: (path: string) => string = (p) => p): string[] {
  const flag = agent === 'gemini' ? '--include-directories' : '--add-dir'
  return folders.flatMap((f) => [flag, dir(expandHome(f))])
}
