// Conversas recuadas dentro da caixa da pasta, cada uma com uma perninha que desce de baixo do
// ícone da pasta e entra pela esquerda dela. As posições saem das alturas fixas das linhas (sem
// medir o layout): cabeçalho de 56px com o ícone de 28px no meio, conversa de 32px
// (ConversationRow), subagente de 24px (AgentRow) e tarefas em segundo plano de 24px (TasksRow),
// com ROW_GAP entre elas.
export const INDENT = 34
// Meio do ícone de pasta: 12px de respiro do cabeçalho + metade do quadradinho de 28px.
const TRUNK = 26
// Base do ícone, contada do topo da lista: 56 / 2 + 14 = 42, e a lista começa em 56.
const TRUNK_TOP = -14
export const ROW_HEIGHT = { conversation: 32, agent: 24, tasks: 24 }
// Espaço entre as linhas (o gap-1 da lista), para o fundo de cada conversa aparecer separado.
export const ROW_GAP = 4
const RADIUS = 6

// Perninha: desce do ícone até o meio da conversa e entra pela lateral.
export function legPath(middle: number): string {
  return `M ${TRUNK} ${TRUNK_TOP} V ${middle - RADIUS} Q ${TRUNK} ${middle} ${TRUNK + RADIUS} ${middle} H ${INDENT}`
}

// Linha de um subagente: o tronco desce do ícone da conversa, no primeiro, ou da linha do
// subagente anterior, nos outros, e entra pela esquerda, um nível para dentro.
// Os números seguem a ConversationRow: ícone de 13px no x 16,5 (10 de respiro + metade dele),
// conversa com 32px e subagente com 24px, com 4px entre as linhas (ROW_GAP). O primeiro sai logo
// abaixo do ícone da conversa (meio dele a 20px acima, menos metade do ícone); os outros, de onde
// a linha do anterior faz a curva (8px do topo dele, 28px acima).
const AGENT_TRUNK_X = 16.5
export function agentPath(first: boolean): string {
  return `M ${AGENT_TRUNK_X} ${first ? -13 : -20} V 8 Q ${AGENT_TRUNK_X} 12 ${AGENT_TRUNK_X + 4} 12 H 25`
}
