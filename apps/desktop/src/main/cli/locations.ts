import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { IS_WIN } from '../platform'

// Onde fica cada peça do comando `argus`.
// O pnpm dev usa outra pasta: aberto depois, tomaria o socket e o script do instalado.
export const DIR_NAME = app.isPackaged ? '.argus' : '.argus-dev'
const DIR = join(homedir(), DIR_NAME)
export const CLI_BIN = join(DIR, 'bin')
export const SCRIPT = join(CLI_BIN, IS_WIN ? 'argus.cmd' : 'argus')
export const SOCKET = join(DIR, 'app.sock')
// Já está no PATH de quem usa o instalador do Claude Code; não pede senha de administrador.
export const LINK = join(homedir(), '.local', 'bin', IS_WIN ? 'argus.cmd' : 'argus')
// Linha que marca o argus.cmd de ~/.local/bin como deste app (no Windows ele é cópia, não link).
export const MARK = `rem argus-app ${DIR_NAME}`
