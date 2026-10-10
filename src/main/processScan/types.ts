import type { DevServer } from '../../shared/devServers'

// Processo com porta aberta, com todas as portas dele. `claude`: o próprio Claude Code ou algo
// no grupo dele (servidor MCP); não é servidor de projeto nenhum. `env`: o ambiente do processo,
// para achar as marcas (vazio no Windows, que não informa). Só no Windows: `name`, o executável
// (node.exe...), e `chain`, os processos acima dele, do pai ao mais antigo.
export type Listening = Omit<DevServer, 'port'> & {
  ports: number[]
  claude: boolean
  env: string
  name?: string
  chain?: number[]
}
