// Modo orquestrador: a sessão principal não executa, só divide o pedido e delega cada etapa a um
// subagente com o modelo e o esforço que a etapa pede. As regras são da pessoa (Configurações >
// Orquestrador); o que nenhuma cobre, o orquestrador decide pelos sinais gerais.

// Modelos que a ferramenta Agent aceita no campo model (apelidos, não nomes completos).
export const AGENT_MODELS = [
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'fable', label: 'Fable' }
]

// Haiku não usa esforço (é o que o `claude` informa na lista de modelos).
export const usesEffort = (model: string): boolean => model !== 'haiku'

export type OrchestratorRule = {
  id: string
  // Tipo de tarefa, em texto livre: é o modelo que compara com a etapa, não uma busca exata.
  task: string
  model: string
  // Vazio = o padrão do Claude Code.
  effort: string
}

export type OrchestratorConfig = {
  // Modelo e esforço da própria sessão quando o orquestrador é ligado nela.
  model: string
  effort: string
  rules: OrchestratorRule[]
  // Texto livre que vai junto das regras.
  extra: string
}

export function orchestratorPrompt(c: OrchestratorConfig): string {
  const rules = c.rules
    .filter((r) => r.task.trim())
    .map((r) => {
      const effort = !usesEffort(r.model) ? 'não passe effort' : r.effort ? `effort: ${r.effort}` : 'não passe effort'
      return `- ${r.task.trim()} → model: ${r.model}, ${effort}`
    })
  const extra = c.extra.trim()
  return [
    '<orquestrador>',
    'Modo orquestrador ligado. Você não executa o trabalho: divide o pedido em etapas, delega cada uma a um subagente (ferramenta Agent) e junta os resultados. Decidir o plano é seu; ler código, escrever, documentar e revisar é dos subagentes.',
    '',
    'Em cada chamada do Agent, passe model e effort pela dificuldade daquela etapa, não do pedido inteiro. Use a regra que melhor descrever a etapa:',
    ...(rules.length ? rules : ['- (nenhuma regra definida)']),
    'Nenhuma regra serve: decida pelos sinais. Sobem o nível: decidir em vez de executar, muitos arquivos, pedido ambíguo, mudança difícil de desfazer.',
    '',
    'Processo:',
    '- Leituras independentes rodam em paralelo.',
    '- Quem valida nunca é o subagente que executou. A validação achou problema: execute de novo com o apontamento e valide outra vez.',
    '- Resultado fraco ou incerto: refaça a etapa um nível acima.',
    '- O subagente não vê esta conversa: passe no prompt tudo o que ele precisa saber.',
    '- Pedido simples (uma pergunta, uma conversa): responda direto, sem delegar.',
    '- Ao terminar, liste cada etapa com o modelo, o esforço e a regra usados.',
    ...(extra ? ['', `Instruções da pessoa: ${extra}`] : []),
    '</orquestrador>'
  ].join('\n')
}
