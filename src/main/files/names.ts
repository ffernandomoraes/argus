import { IS_WIN } from '../platform'

// Nomes de arquivo que o sistema aceita. Lógica pura.

// Caracteres que o Windows não aceita em nome de arquivo (no Mac, só a barra e o zero).
const INVALID_CHARS = IS_WIN ? /[\\/<>:"|?*\x00-\x1f]/ : /[/\x00]/
// Nomes que o Windows reserva para dispositivos, com ou sem extensão ("con", "nul.txt").
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export const isReservedOnWindows = (name: string): boolean => RESERVED.test(name)

// Um nome só (sem pastas). No Windows, também sem os nomes reservados e sem ponto ou espaço no
// fim, que o Windows corta (o item apareceria com outro nome, ou o erro cru do sistema).
export function invalidName(name: string): boolean {
  if (!name || name === '.' || name === '..' || INVALID_CHARS.test(name)) return true
  return IS_WIN && (RESERVED.test(name) || /[. ]$/.test(name))
}

// Nome que pode trazer subpastas ("src/novo.ts"; no Windows, também com "\"): cada parte vale
// como nome.
export function invalidPath(name: string): boolean {
  const parts = name.split(IS_WIN ? /[\\/]/ : '/').filter(Boolean)
  return parts.length === 0 || parts.some(invalidName)
}
