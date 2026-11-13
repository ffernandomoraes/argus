// Worktrees criados pelo Argus: reservar, criar no primeiro envio, situação e remover; e os em que
// o próprio Claude entrou, acompanhados do mesmo jeito (ver shared/worktrees.ts).
export { adoptWorktree } from './adopt'
export { materializeWorktree, reserveWorktree } from './create'
export { withWorktreeHint } from './hint'
export { removeWorktree } from './remove'
export { worktreeStatus } from './status'
export { worktreeOf } from './store'
