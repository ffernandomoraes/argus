import { join } from 'node:path'
import { SYSTEM32, WINDOWS_POWERSHELL } from '../platform'

// Programas do Windows pelo caminho completo: não dependem do PATH de quem abriu o app.
export const POWERSHELL = WINDOWS_POWERSHELL
export const NETSTAT = join(SYSTEM32, 'NETSTAT.EXE')
export const TASKKILL = join(SYSTEM32, 'taskkill.exe')

// windowsHide em toda chamada: sem ele, cada programa de linha de comando aberto pelo app pisca uma
// janela preta na tela.
export const HIDDEN = { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
