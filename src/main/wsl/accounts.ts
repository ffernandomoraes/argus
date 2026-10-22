import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { app } from 'electron'
import { MAIN_ACCOUNT } from '../../shared/auth'
import { SHARED } from '../accounts/links'
import { seed } from '../accounts/seed'
import { writeStdin } from '../lib/childProcess'
import { WSL_EXE, type DistroInfo } from './distros'
import { log } from './log'
import { toUnc } from './path'

// Contas do Claude num projeto do WSL. A principal é a do ~/.claude do Linux, a mesma do terminal
// de lá. As outras ganham uma pasta própria no Linux (~/.argus/accounts/<id>), com os mesmos
// links para a principal que o app cria no Mac e no Windows (ver accounts/links.ts), mas para a
// principal do Linux. O login de cada conta é separado do Windows: o Claude Code de lá guarda o
// dele no .credentials.json da pasta, e dividir o mesmo arquivo com o do Windows faria um derrubar
// o outro a cada renovação.

const ROOT = app.isPackaged ? '.argus/accounts' : '.argus-dev/accounts'

// Pasta da conta no Linux; nada na principal (o `claude` sem a variável usa ~/.claude).
export function wslAccountDir(info: DistroInfo, id: string): string | undefined {
  return id === MAIN_ACCOUNT ? undefined : `${info.home}/${ROOT}/${id}`
}

// Pastas de status (<pasta>/sessions) das contas no Linux, vistas pelo Windows.
export function wslStatusDirs(distro: string, info: DistroInfo, ids: string[]): string[] {
  return ids.map((id) => toUnc(distro, `${wslAccountDir(info, id) ?? `${info.home}/.claude`}/sessions`))
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// Links pelo próprio Linux (ln -s): criados do Windows, pela pasta de rede, não se sabe se viram
// links de verdade lá dentro.
function linkScript(dir: string, main: string): string {
  const lines = SHARED.map(
    (name) => `[ -e ${sq(`${main}/${name}`)} ] && [ ! -e ${sq(`${dir}/${name}`)} ] && [ ! -L ${sq(`${dir}/${name}`)} ] && ln -s ${sq(`${main}/${name}`)} ${sq(`${dir}/${name}`)}`
  )
  return [`mkdir -p ${sq(`${dir}/sessions`)} ${sq(`${main}/projects`)}`, ...lines, 'exit 0', ''].join('\n')
}

const ready = new Set<string>()

// Prepara a pasta da conta no Linux antes de cada `claude` dela: cria, copia as configurações da
// principal na primeira vez e liga o que é compartilhado. Uma vez por abertura do app.
export async function prepareWslAccount(distro: string, info: DistroInfo, id: string): Promise<void> {
  const dir = wslAccountDir(info, id)
  const key = `${distro}\0${id}`
  if (!dir || ready.has(key)) return
  const unc = toUnc(distro, dir)
  try {
    if (!existsSync(unc)) {
      mkdirSync(unc, { recursive: true })
      seed(unc, toUnc(distro, info.home))
    }
  } catch (err) {
    log(`conta ${id} no WSL (${distro}): não deu para criar a pasta`, (err as Error).message)
  }
  await new Promise<void>((resolve) => {
    const child = spawn(WSL_EXE, ['-d', distro, '--exec', 'sh', '-s'], { windowsHide: true })
    child.on('error', () => resolve())
    child.on('close', () => resolve())
    writeStdin(child, linkScript(dir, `${info.home}/.claude`))
  })
  ready.add(key)
}
