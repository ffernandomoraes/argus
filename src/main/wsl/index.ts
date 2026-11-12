import { nativeClaudeFound } from '../claudePath'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'
import { claudeDistro } from './distros'
import { parseWslPath, sameDistro } from './path'

// Projetos no Linux do WSL, com o app instalado no Windows. Quem decide onde o Claude Code roda é a
// pasta: uma do WSL (\\wsl.localhost\<distro>\...) roda dentro daquela distro, com o `claude`, o
// login, o histórico e o git de lá; uma do Windows roda no Windows, como sempre. Sem o `claude` do
// Windows instalado, mas com o do WSL, tudo roda no WSL (as pastas do Windows pelo /mnt/c).
// No Mac nada daqui roda: toda função devolve nulo.

export { claudeDistro, distroInfo, ensureDistro, homeUnc, knownDistros, listDistros, loadDistro, runningDistros, warmUp } from './distros'
export type { DistroInfo } from './distros'
export { trashPath } from './trash'
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

// A conversa desta pasta roda com o mesmo login do `claude` do app (o que a barra de uso lê)? Com o
// `claude.exe` no Windows, a de uma pasta do WSL usa o login de lá, que pode ser de outra conta do
// Claude: os limites que ela informa não são os da conta que o app mostra (relato de 2026-11-12: a
// barra trocava o semanal de uma conta pelo de outra a cada resposta).
export function sharesAppLogin(cwd: string): boolean {
  const own = distroFor()
  const distro = distroFor(cwd)
  return own && distro ? sameDistro(own, distro) : own === distro
}
