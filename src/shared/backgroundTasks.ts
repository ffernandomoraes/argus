// Tarefa que o Claude deixou rodando em segundo plano (comando, monitor, workflow): o que o app sabe
// dela para mostrar a saída. Subagentes ficam de fora (ver RunningAgent).
export type BackgroundTaskInfo = {
  // Para que serve, escrita pelo Claude ao lançar (a mesma da lista de tarefas do Claude Code).
  description: string
  // local_bash, monitor, local_workflow...
  type: string
  // Arquivo onde o Claude Code grava a saída. Só o comando informa; o do monitor é procurado.
  outputFile?: string
}

// O que o resultado da ferramenta diz da tarefa que ficou em segundo plano: o id e, no comando, o
// arquivo da saída. Textos do Claude Code 2.1:
// "Command running in background with ID: b2q9h22xw. Output is being written to: /tmp/.../b2q9h22xw.output. ..."
// "Monitor started (task bl7lk83t5, expires in 30m ..."
export function backgroundTaskOf(result: string): { id: string; outputFile?: string } | null {
  const command = /Command running in background with ID: ([\w-]+)\. Output is being written to: (.+?\.output)/.exec(result)
  if (command) return { id: command[1], outputFile: command[2] }
  const monitor = /^Monitor started \(task ([\w-]+)/.exec(result)
  return monitor ? { id: monitor[1] } : null
}

// Saída lida de uma vez: o que o arquivo ganhou desde `offset`. reset: o arquivo é outro (ou
// encolheu), e o texto começa do zero. missing: o arquivo não existe (ainda, ou já foi apagado).
export type TaskOutputChunk = { text: string; offset: number; reset: boolean; missing: boolean }

// Onde procurar a saída: o arquivo informado ou, sem ele, pela pasta da sessão.
export type TaskOutputRef = { cwd: string; sessionId: string; taskId: string; outputFile?: string }
