import { IS_WIN } from '../platform'

// Pastas do Linux do WSL vistas pelo Windows: \\wsl.localhost\<distro>\home\... (Windows 11 e 10
// recentes) ou \\wsl$\<distro>\... (o nome antigo, que continua valendo). Funções puras: valem em
// qualquer sistema, mas só o Windows chega a ter caminhos assim (ver isWslPath).

const UNC = /^[\\/]{2}(wsl\.localhost|wsl\$)[\\/]([^\\/]+)(?:[\\/](.*))?$/i

export type WslPath = { distro: string; linux: string }

// Distro e caminho dentro do Linux; nulo se não é uma pasta do WSL.
export function parseWslPath(path: string): WslPath | null {
  const m = UNC.exec(path)
  if (!m) return null
  const rest = (m[3] ?? '').split(/[\\/]+/).filter(Boolean)
  return { distro: m[2], linux: '/' + rest.join('/') }
}

// No Windows, a pasta é do Linux do WSL?
export const isWslPath = (path: string): boolean => IS_WIN && !!parseWslPath(path)

// Prefixo das pastas do WSL; o antigo (\\wsl$) só onde o novo não existe (ver distros.ts).
let prefix = '\\\\wsl.localhost'
export function setUncPrefix(value: string): void {
  prefix = value
}

// Caminho do Linux visto pelo Windows.
export function toUnc(distro: string, linux: string): string {
  const rest = linux.split('/').filter(Boolean).join('\\')
  return `${prefix}\\${distro}\\${rest}`
}

// Caminho como o Linux enxerga: a pasta do WSL vira /home/...; uma do Windows (C:\x), /mnt/c/x,
// onde o WSL monta os discos. Outro caminho (de rede) fica como está.
export function toLinux(path: string): string {
  const wsl = parseWslPath(path)
  if (wsl) return wsl.linux
  const drive = /^([a-zA-Z]):[\\/]?(.*)$/.exec(path)
  if (!drive) return path.replace(/\\/g, '/')
  const rest = drive[2].split(/[\\/]+/).filter(Boolean).join('/')
  return `/mnt/${drive[1].toLowerCase()}${rest ? '/' + rest : ''}`
}

// Caminho do Linux escrito pelo Claude que roda no WSL (/home/u/x.ts) visto do Windows, na mesma
// distro de `root`. /mnt/c/x volta a ser C:\x.
export function fromLinux(distro: string, linux: string): string {
  const mnt = /^\/mnt\/([a-z])(?:\/(.*))?$/.exec(linux)
  if (mnt) return `${mnt[1].toUpperCase()}:\\${(mnt[2] ?? '').split('/').filter(Boolean).join('\\')}`
  return toUnc(distro, linux)
}

// "Ubuntu" e "ubuntu" são a mesma distro para o Windows.
export const sameDistro = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
