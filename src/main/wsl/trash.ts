import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shell } from 'electron'
import { homeUnc } from './distros'
import { parseWslPath } from './path'
import { tr } from '../i18n'
import { IS_WIN } from '../platform'

// Pasta do WSL não tem Lixeira do Windows: para o Windows ela é um local de rede, e o
// shell.trashItem desiste com erro (não apaga de vez). Lá o item vai para a Lixeira do próprio
// Linux (~/.local/share/Trash, padrão freedesktop): o Nautilus, o Dolphin e o `gio trash --list`
// enxergam e restauram. No Mac, no Linux e nas pastas do Windows, a Lixeira do sistema.
export async function trashPath(full: string): Promise<void> {
  const wsl = IS_WIN ? parseWslPath(full) : null
  if (!wsl) return shell.trashItem(full)
  const home = homeUnc(wsl.distro, wsl.linux)
  if (!home) throw new Error(tr('Pasta do usuário do WSL não encontrada.', 'WSL home folder not found.'))
  await moveToTrash(full, wsl.linux, join(home, '.local', 'share', 'Trash'))
}

// Pelo padrão: o item vai para Trash/files/<nome> e a origem fica em Trash/info/<nome>.trashinfo.
// O .trashinfo é criado antes e só se ainda não existir: reserva o nome, mesmo com duas
// exclusões ao mesmo tempo. Exportada para testar fora do Windows.
export async function moveToTrash(full: string, linux: string, trash: string): Promise<void> {
  const files = join(trash, 'files')
  const info = join(trash, 'info')
  await mkdir(files, { recursive: true })
  await mkdir(info, { recursive: true })
  const base = linux.split('/').filter(Boolean).pop() ?? 'item'
  const record = `[Trash Info]\nPath=${encodePath(linux)}\nDeletionDate=${localStamp(new Date())}\n`
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? base : `${base}.${n}`
    const infoFile = join(info, `${name}.trashinfo`)
    try {
      await writeFile(infoFile, record, { flag: 'wx' })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw err
    }
    const target = join(files, name)
    // Sobrou um item com esse nome sem .trashinfo: tenta o próximo nome. Conferido antes porque,
    // no Windows, o rename substitui o arquivo que já estiver lá.
    if (await exists(target)) {
      await rm(infoFile, { force: true })
      continue
    }
    try {
      await rename(full, target)
      return
    } catch (err) {
      await rm(infoFile, { force: true })
      throw err
    }
  }
  throw new Error(tr('A Lixeira do WSL já tem itens demais com esse nome.', 'The WSL Trash already has too many items with this name.'))
}

const exists = (path: string) => access(path).then(
  () => true,
  () => false
)

// Caminho em formato de URL, como pede o padrão ("/home/ana/meu projeto" vira ".../meu%20projeto").
const encodePath = (linux: string) => linux.split('/').map(encodeURIComponent).join('/')

// AAAA-MM-DDThh:mm:ss no horário local, sem fuso (o padrão pede assim).
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
