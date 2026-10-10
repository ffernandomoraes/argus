// Conversas que o Claude Code gravou em ~/.claude/projects: a lista de cada pasta, o uso de
// contexto, a Lixeira e as pastas onde já houve conversa. A leitura dos .jsonl é de transcripts/.
export { projectDir as sessionsDir } from '../transcripts/projectDir'
export { sessionContext } from './context'
export { listKnownFolders } from './knownFolders'
export { listSessions } from './list'
export { trashSession } from './trash'
