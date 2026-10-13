import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { IS_LINUX } from '../platform'

// Linux: o Chromium isola as janelas (sandbox) por um recurso do kernel (user namespaces) ou, sem
// ele, pelo programa chrome-sandbox com permissão de root. No AppImage o chrome-sandbox nunca tem
// essa permissão, e o Ubuntu 24.04 bloqueia o recurso do kernel para programas sem perfil do
// AppArmor: o app nem abre ("The SUID sandbox helper binary was found, but is not configured
// correctly"). Só nesse caso o isolamento sai; onde ele funciona, fica.

function readFlag(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return null
  }
}

function setuidSandbox(): boolean {
  try {
    const s = statSync(join(dirname(process.execPath), 'chrome-sandbox'))
    return s.uid === 0 && (s.mode & 0o4000) !== 0
  } catch {
    return false
  }
}

function userNamespacesBlocked(): boolean {
  return (
    readFlag('/proc/sys/kernel/apparmor_restrict_unprivileged_userns') === '1' ||
    readFlag('/proc/sys/kernel/unprivileged_userns_clone') === '0' ||
    readFlag('/proc/sys/user/max_user_namespaces') === '0'
  )
}

// Antes do app ficar pronto: depois disso o Chromium já leu as opções.
export function setupLinuxSandbox(): void {
  if (!IS_LINUX || setuidSandbox() || !userNamespacesBlocked()) return
  app.commandLine.appendSwitch('no-sandbox')
}
