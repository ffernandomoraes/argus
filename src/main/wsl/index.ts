import { nativeClaudeFound } from '../claudePath'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'
import { claudeDistro } from './distros'
import { parseWslPath } from './path'

// Projetos no Linux do WSL, com o app instalado no Windows. Quem decide onde o Claude Code roda é a
// pasta: uma do WSL (\\wsl.localhost\<distro>\...) roda dentro daquela distro, com o `claude`, o
// login, o histórico e o git de lá; uma do Windows roda no Windows, como sempre. Sem o `claude` do
// Windows instalado, mas com o do WSL, tudo roda no WSL (as pastas do Windows pelo /mnt/c).
// No Mac nada daqui roda: toda função devolve nulo.

export { claudeDistro, distroInfo, ensureDistro, homeUnc, knownDistros, listDistros, loadDistro, warmUp } from './distros'
export type { DistroInfo } from './distros'
export { fromLinux, isWslPath, parseWslPath, sameDistro, toLinux, toUnc } from './path'

// O `claude` do Windows existe? Perguntado a cada leitura de conversa, e procurar no PATH abre
// dezenas de pastas: a resposta vale por alguns segundos (instalado com o app aberto, aparece logo).
const NATIVE_TTL = 5000
let native = { found: false, at: 0 }
function hasNativeClaude(): boolean {
  if (Date.now() - native.at > NATIVE_TTL) native = { found: nativeClaudeFound(), at: Date.now() }
  return native.found
}

// Distro onde roda o Claude Code de uma pasta (ou, sem pasta, o do app: login, uso). Nulo: no
// próprio sistema.
export function distroFor(path?: string): string | null {
  if (!IS_WIN) return null
  const wsl = path ? parseWslPath(expandHome(path)) : null
  if (wsl) return wsl.distro
  return hasNativeClaude() ? null : claudeDistro()
}
