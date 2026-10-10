import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Atualização no Windows: baixa o instalador da versão nova e roda ele em modo silencioso quando o
// app fecha: ele termina de fechar o que sobrou do app, troca os arquivos e, se pedido, abre o
// Argus de novo.

// O instalador cria este desinstalador na pasta do app; sem ele, o app não foi instalado por ele
// (rodando de uma pasta copiada, o instalador instalaria outra cópia em vez de atualizar esta).
export function installedByInstaller(): boolean {
  return existsSync(join(dirname(process.execPath), 'Uninstall Argus.exe'))
}

// /S, sem telas. --updated: é atualização (fecha o que sobrar do app aberto e mantém os atalhos
// como estão). --force-run: abre o app no fim.
export function spawnInstaller(installer: string, relaunch: boolean): ChildProcess {
  return spawn(installer, ['/S', '--updated', ...(relaunch ? ['--force-run'] : [])], { detached: true, stdio: 'ignore' })
}
