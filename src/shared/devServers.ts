// Servidor local (porta aberta) que algum Claude Code subiu e deixou rodando.
export type DevServer = {
  port: number
  pid: number
  // Grupo de processos: encerrar derruba o comando inteiro (pnpm dev + vite), não só quem
  // ouve a porta.
  pgid: number
  // Pasta onde o processo roda; o nome do projeto vem dela.
  cwd: string
  command: string
  // Conversa do Claude Code que rodou o comando.
  sessionId?: string
  // Grupos que não dá para encerrar daqui. app: o servidor de dev deste próprio app (derrubaria
  // o editor). claude: o grupo tem um Claude Code rodando (um servidor MCP, por exemplo).
  locked?: 'app' | 'claude'
}
