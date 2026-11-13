import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { tr } from '../i18n'
import { IS_LINUX } from '../platform'

// Linux: o AppImage é um arquivo solto, sem instalador. Para o Argus aparecer no menu de apps (como
// o atalho que o instalador do Windows cria), o app grava o atalho (.desktop) e o ícone na pasta do
// usuário a cada abertura, apontando para o AppImage de onde abriu. Movido o arquivo, o atalho
// segue para o lugar novo na próxima abertura.

// Ícone do app: no empacotado vem junto (extraResources); no pnpm dev, da pasta build.
export function linuxIcon(): string | undefined {
  if (!IS_LINUX) return undefined
  return app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build', 'icon.png')
}

const quote = (s: string) => `"${s.replace(/(["`$\\])/g, '\\$1')}"`

export function installDesktopEntry(): void {
  const appImage = process.env.APPIMAGE
  if (!IS_LINUX || !app.isPackaged || !appImage) return
  const share = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'))
  const icon = join(share, 'icons', 'argus.png')
  const entry = join(share, 'applications', 'argus.desktop')
  const text = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Argus',
    `Comment=${tr('Canvas infinito para orquestrar projetos e agentes do Claude Code', 'Infinite canvas to orchestrate Claude Code projects and agents')}`,
    `Exec=${quote(appImage)} %U`,
    `Icon=${icon}`,
    'Terminal=false',
    'Categories=Development;',
    'StartupWMClass=Argus',
    ''
  ].join('\n')
  try {
    mkdirSync(join(share, 'icons'), { recursive: true })
    mkdirSync(join(share, 'applications'), { recursive: true })
    const source = linuxIcon()
    if (source && existsSync(source)) copyFileSync(source, icon)
    let current = ''
    try {
      current = readFileSync(entry, 'utf8')
    } catch {
      // ainda não existe
    }
    if (current !== text) writeFileSync(entry, text, { mode: 0o644 })
  } catch (err) {
    console.warn('[linux] não deu para criar o atalho no menu de apps:', (err as Error).message)
  }
}
