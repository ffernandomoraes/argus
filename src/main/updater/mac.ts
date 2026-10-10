import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

// Troca do app no Mac: baixa o .zip, confere se a assinatura é a mesma do app instalado e troca
// o .app depois que o processo sai.

const run = promisify(execFile)

// O .app em uso, ou null fora de um .app (desenvolvimento). Pelo primeiro ".app" seguido de
// "/Contents/MacOS/": um ".app" no meio do caminho da pasta não confunde.
export function currentBundle(execPath = process.execPath): string | null {
  return /^(.*?\.app)\/Contents\/MacOS\//.exec(execPath)?.[1] ?? null
}

// Requisito de assinatura (designated requirement). Com o mesmo certificado, ele é igual em todas
// as versões; é por ele que o macOS reconhece o app e mantém as permissões.
async function requirement(path: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await run('codesign', ['-d', '-r-', path])
    return `${stdout}\n${stderr}`.split('\n').find((l) => l.includes('designated =>'))?.trim() ?? null
  } catch {
    return null
  }
}

// Descompacta o .zip na pasta e devolve o .app que veio nele, achado pelo conteúdo (o app em uso
// pode ter sido renomeado).
export async function extractApp(zip: string, dir: string): Promise<string> {
  await run('ditto', ['-x', '-k', zip, dir])
  for (const name of await readdir(dir)) {
    const path = join(dir, name)
    if (name.endsWith('.app') && (await stat(path)).isDirectory()) return path
  }
  throw new Error('A versão baixada não tem o app.')
}

// A versão baixada: assinatura íntegra e o mesmo certificado do app em uso.
export async function verifyApp(next: string, current: string): Promise<void> {
  try {
    await run('codesign', ['--verify', '--deep', '--strict', next])
  } catch {
    throw new Error('A versão baixada não passou na conferência de assinatura.')
  }
  const [installed, downloaded] = await Promise.all([requirement(current), requirement(next)])
  if (!installed || installed !== downloaded) throw new Error('A versão baixada foi assinada por outro certificado.')
}

// O executável do app novo está lá? Sem ele, a troca deixaria no lugar um app que não abre.
export function hasExecutable(next: string): boolean {
  return existsSync(join(next, 'Contents', 'MacOS', basename(process.execPath)))
}

// Roda solto, depois que o app fecha: espera o processo sair, troca o .app e, se pedido, reabre.
// - Um .old que sobrou de outra troca sai antes: com ele no caminho, o mv poria o app dentro dele
//   (Argus.app.old/Argus.app) e, se a troca falhasse, a volta deixaria Argus.app/Argus.app.
// - A assinatura é conferida de novo na hora: entre o download e o fechamento, a pasta pode ter
//   perdido arquivos. Falhou: fica o app atual e a versão baixada some.
// - Se a troca falhar no meio, devolve o app antigo.
const SWAP_SCRIPT = `
pid="$1"; next="$2"; target="$3"; relaunch="$4"; dir="$5"
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
rm -rf "$target.old"
if codesign --verify --deep --strict "$next" 2>/dev/null; then
  if mv "$target" "$target.old"; then
    if mv "$next" "$target"; then rm -rf "$target.old"; else mv "$target.old" "$target"; fi
  fi
fi
xattr -dr com.apple.quarantine "$target" 2>/dev/null
rm -rf "$dir"
[ "$relaunch" = 1 ] && open "$target"
`

// argv[0] do script: "argus-update" (o install.sh espera ele terminar antes de trocar o app).
export function spawnSwap(next: string, target: string, dir: string, relaunch: boolean): ChildProcess {
  const args = [String(process.pid), next, target, relaunch ? '1' : '0', dir]
  return spawn('/bin/sh', ['-c', SWAP_SCRIPT, 'argus-update', ...args], { detached: true, stdio: 'ignore' })
}
