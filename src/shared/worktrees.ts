// Worktree: uma tarefa isolada do mesmo repositório, numa pasta própria e numa branch própria
// (`git worktree`). O Argus reserva a pasta em ~/.argus/worktrees/<repo>/<tarefa> quando a pessoa
// pede a tarefa, cria de fato no primeiro envio da conversa, mostra como card filho da pasta e
// avisa o agente de que está nela. Nome da branch e PR ficam com o agente, na conversa.

// O que o Argus guarda de cada worktree. `main`: a pasta principal do repositório, onde o ambiente
// (Docker, banco) costuma rodar. `base`: a branch em que a pasta principal estava ao pedir a tarefa.
// `pending`: reservado, ainda sem pasta (a conversa não mandou a primeira mensagem).
export type WorktreeInfo = {
  path: string
  main: string
  base: string
  pending?: boolean
}

export type WorktreeReserved = { ok: true; path: string; base: string } | { ok: false; error: string }

// Situação do worktree para o card. state: reservado (sem pasta ainda), preparando (copiando .env e
// instalando dependências) ou pronto. error: a criação ou a instalação falhou. files: arquivos
// alterados pela tarefa (comitados desde a base ou não).
export type WorktreeStatus = {
  state: 'pending' | 'preparing' | 'ready'
  error?: string
  // Branch da tarefa agora (a provisória wip/... até o agente renomear); nula antes de criar.
  branch: string | null
  files: number
  uncommitted: number
  unpushed: number
}

// "Melhorar o checkout!" → "melhorar-o-checkout": sem acento, sem símbolo, em minúsculas.
export function slugify(text: string, max = 48): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '')
}

// Aviso oculto para o agente que trabalha num worktree: onde está, de onde saiu e como não
// atrapalhar as outras tarefas que rodam em paralelo.
export function worktreePrompt(w: WorktreeInfo, branch: string | null): string {
  return [
    '<worktree>',
    `Você está num git worktree criado pelo Argus: ${w.path}`,
    `Branch desta tarefa: ${branch ?? '(desconhecida)'}, criada a partir de ${w.base}.`,
    `Repositório principal: ${w.main}. Outras tarefas rodam em paralelo em outros worktrees do mesmo repositório; as mudanças desta ficam só nesta pasta.`,
    '',
    'Como se comportar:',
    '- Trabalhe só nesta pasta. Não edite arquivos do repositório principal nem de outros worktrees.',
    '- O nome da branch começa provisório (wip/...). Quando entender a tarefa, renomeie com `git branch -m` seguindo a convenção do repositório (feat/, fix/, chore/...). Não troque de branch (git checkout/switch): o worktree é preso a esta.',
    `- PR só se a pessoa pedir. Antes de abrir, confirme com ela para qual branch vai (a tarefa saiu de ${w.base}).`,
    '- Infraestrutura (Docker, banco, Redis, filas) costuma já estar rodando a partir do repositório principal: reaproveite em vez de subir outra cópia. Só suba uma separada se a de lá não estiver rodando.',
    '- Porta ocupada ao subir um app: é outra tarefa usando. Use outra porta livre, e não comite essa troca de porta.',
    '- Os .env foram copiados do repositório principal. As dependências são instaladas pelo Argus logo após a criação; se faltar alguma ao rodar, instale.',
    '</worktree>'
  ].join('\n')
}
