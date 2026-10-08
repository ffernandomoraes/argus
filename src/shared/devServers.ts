// Servidor local (porta aberta) que o Claude Code ou o play subiu, ou que roda dentro de uma
// pasta do canvas.
export type DevServer = {
  port: number
  pid: number
  // Grupo de processos: encerrar derruba o comando inteiro (pnpm dev + vite), não só quem
  // ouve a porta.
  pgid: number
  // Pasta onde o processo roda; o nome do projeto vem dela.
  cwd: string
  // productName do package.json da pasta, quando tem; senão a interface usa o nome da pasta.
  appName?: string
  command: string
  // Conversa do Claude Code que rodou o comando.
  sessionId?: string
  // Servidor deste Argus que está aberto (o pnpm dev dele): encerrar fecha o app.
  current?: boolean
  // Não dá para encerrar daqui: uma sessão do Claude Code abriu o processo no grupo dela (um
  // servidor MCP) e encerrar derrubaria a sessão. Instâncias do Argus, inclusive esta, podem.
  locked?: 'claude'
}

// Servidor de uma pasta do canvas, para o botão de iniciar e encerrar acima dela. Conta
// qualquer porta aberta por um processo dentro da pasta, venha de onde vier o comando.
export type ProjectServer = {
  // Script do package.json que o botão roda (dev; sem ele, start). Nulo: não dá para iniciar daqui.
  script: string | null
  // Comando completo, como `pnpm run dev`.
  command: string | null
  // starting: iniciado daqui e ainda sem porta aberta.
  state: 'stopped' | 'starting' | 'running'
  ports: number[]
  // Rodando, mas nenhum processo dá para encerrar daqui (ver DevServer.locked).
  locked?: DevServer['locked']
  // Iniciado daqui e saiu sem ninguém pedir: últimas linhas da saída, para dizer o motivo.
  error?: string
}
