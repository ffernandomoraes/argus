import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { MAIN_ACCOUNT } from '../../shared/auth'

// A pasta de configuração da principal, a mesma do terminal e do VS Code.
export const MAIN_DIR = join(homedir(), '.claude')
// Mesma separação do comando argus: o pnpm dev tem as contas dele.
export const ROOT = join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'accounts')
export const ID = /^[a-f0-9]{8}$/
// Lido só na hora de usar: o pnpm dev troca a pasta de dados depois de importar os módulos.
export const registryFile = () => join(app.getPath('userData'), 'accounts.json')

// Pasta da conta. A principal não tem: o `claude` sem a variável usa ~/.claude.
export function accountDir(id: string): string | undefined {
  return id === MAIN_ACCOUNT ? undefined : join(ROOT, id)
}
