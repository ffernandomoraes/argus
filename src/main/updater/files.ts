import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { IS_WIN } from '../platform'

const run = promisify(execFile)
const PREFIX = 'argus-update-'

// Onde o download espera a hora de instalar: a pasta de dados do app, nos dois sistemas. Na
// temporária não: o macOS apaga dela o que passa de 3 dias (todo dia de madrugada), e a troca ao
// fechar o app pegaria um .app pela metade; o Windows também a limpa sozinho.
const downloadsDir = () => join(app.getPath('userData'), 'updates')

// Pasta nova e só deste download.
export async function newDownloadDir(): Promise<string> {
  await mkdir(downloadsDir(), { recursive: true })
  return mkdtemp(join(downloadsDir(), PREFIX))
}

// No Mac, pelo `rm` do sistema: no Electron, o fs enxerga o app.asar como pasta e o rm recursivo
// falha. No Windows a pasta só tem o instalador baixado.
export const removePath = (path: string) =>
  IS_WIN ? rm(path, { recursive: true, force: true }).catch(() => {}) : run('rm', ['-rf', path]).then(() => {}, () => {})

// Sobras de atualizações anteriores: o instalador do Windows que estava rodando quando o app
// fechou, um download interrompido, uma versão baixada que não chegou a entrar (app derrubado).
// No Mac, também as da pasta temporária, onde as versões antigas do app baixavam.
export async function cleanupDownloads(): Promise<void> {
  for (const parent of IS_WIN ? [downloadsDir()] : [downloadsDir(), tmpdir()]) {
    let names: string[]
    try {
      names = await readdir(parent)
    } catch {
      // Pasta ainda não existe, ou sem acesso: fica para a próxima.
      continue
    }
    for (const name of names) {
      const path = join(parent, name)
      // Nunca a pasta de onde este app está rodando (aberto, por engano, de dentro dela).
      if (name.startsWith(PREFIX) && !process.execPath.startsWith(path + sep)) await removePath(path)
    }
  }
}
