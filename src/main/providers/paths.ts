import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { MAIN_PROVIDER_ACCOUNT, type ProviderId } from '../../shared/providers'

// Mesma separação das contas do Claude (accounts/paths.ts): o pnpm dev tem as dele.
const DATA = () => join(homedir(), app.isPackaged ? '.argus' : '.argus-dev')

export const ID = /^[a-f0-9]{8}$/

// Pasta de uma conta de agente. A principal não tem: o CLI sem variável usa a do terminal.
export function providerAccountDir(provider: ProviderId, id: string): string | undefined {
  return id === MAIN_PROVIDER_ACCOUNT ? undefined : join(DATA(), 'agents', provider, id)
}

export const providerRoot = (provider: ProviderId) => join(DATA(), 'agents', provider)

// Biblioteca de agentes do Cursor: o CLI dele só lê agentes da pasta do projeto, então os globais
// ficam com o Argus e vão no texto da mensagem (ver agentMentions.ts).
export const cursorAgentsDir = () => join(DATA(), 'cursor-agents')

// CLIs que o próprio Argus instala (o Gemini, rodado pelo Node do Electron).
export const toolsDir = () => join(DATA(), 'tools')

// Lido só na hora de usar: o pnpm dev troca a pasta de dados depois de importar os módulos.
export const registryFile = () => join(app.getPath('userData'), 'agent-accounts.json')
