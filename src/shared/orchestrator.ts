import { PROVIDERS, type ProviderId } from './providers'

// Modo orquestrador: a sessão principal não executa, só divide o pedido e delega cada etapa a um
// agente com o modelo e o esforço que a etapa pede. As regras são da pessoa (Configurações >
// Orquestrador); o que nenhuma cobre, o orquestrador decide pelos sinais gerais.
// No chat, qualquer agente orquestra qualquer outro: a etapa vai pela ferramenta delegate do Argus
// (src/main/orchestration/), que roda no Claude, Codex, Gemini ou Cursor. No terminal, só o Claude,
// pelos subagentes dele (ferramenta Agent).

// Modelos que a ferramenta Agent do Claude aceita no campo model (apelidos, não nomes completos).
export const AGENT_MODELS = [
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'fable', label: 'Fable' }
]

// Haiku não usa esforço (é o que o `claude` informa na lista de modelos).
export const usesEffort = (model: string): boolean => !model.includes('haiku')

// A ferramenta Agent só aceita apelidos: uma versão escolhida ("claude-opus-4-5") vira o da família.
export const agentAlias = (model: string): string => AGENT_MODELS.find((m) => model.toLowerCase().includes(m.value))?.value ?? model

// Ferramentas do Argus para o orquestrador (servidor "argus").
export const DELEGATE_TOOL = 'delegate'
export const LIST_AGENTS_TOOL = 'list_agents'
export const REPORT_VALIDATION_TOOL = 'report_validation'

// Quem executa uma etapa: "claude", "codex", "gemini" ou "cursor", com a conta depois de ":"
// ("codex:main"). Sem conta, a padrão do agente.
export type StepProvider = 'claude' | ProviderId
export type StepAgent = { provider: StepProvider; account?: string }

export const STEP_PROVIDER_NAMES: Record<StepProvider, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor' }

export function parseStepAgent(id: string | undefined): StepAgent | null {
  const m = /^(claude|codex|gemini|cursor)(?::([a-z0-9]+))?$/.exec((id ?? '').trim().toLowerCase())
  return m ? { provider: m[1] as StepProvider, ...(m[2] && { account: m[2] }) } : null
}

export const stepAgentId = (a: StepAgent): string => (a.account ? `${a.provider}:${a.account}` : a.provider)

export const isStepProvider = (p: string): p is StepProvider => p === 'claude' || (PROVIDERS as string[]).includes(p)

// Como a etapa aparece no chat: "Codex - gpt-5.5".
export function stepLabel(agent: string | undefined, model: string | undefined): string {
  const parsed = parseStepAgent(agent)
  const name = parsed ? STEP_PROVIDER_NAMES[parsed.provider] : agent || 'Claude'
  return model ? `${name} - ${model}` : name
}

export type OrchestratorRule = {
  id: string
  // Tipo de tarefa, em texto livre: é o modelo que compara com a etapa, não uma busca exata.
  task: string
  // Quem executa ("claude", "codex:main"...). Regras antigas não têm: Claude.
  agent?: string
  model: string
  // Vazio = o padrão do agente.
  effort: string
}

export type OrchestratorConfig = {
  // Quem orquestra ("claude", "codex:main"...) e com que modelo e esforço. A conversa nova adota;
  // a que já começou com outro agente não troca (ver orchestratorFit). Configuração antiga não tem
  // agente: Claude.
  agent?: string
  model: string
  effort: string
  rules: OrchestratorRule[]
  // Texto livre que vai junto das regras.
  extra: string
}

const ruleAgent = (r: OrchestratorRule): string => r.agent || 'claude'

// tools: "argus" no chat (ferramenta delegate, qualquer agente); "native" no terminal (ferramenta
// Agent do Claude, só as regras do Claude).
export function orchestratorPrompt(c: OrchestratorConfig, tools: 'argus' | 'native' = 'argus'): string {
  return tools === 'argus' ? argusPrompt(c) : nativePrompt(c)
}

function argusPrompt(c: OrchestratorConfig): string {
  const rules = c.rules
    .filter((r) => r.task.trim())
    .map((r) => {
      const model = r.model ? `model: ${r.model}` : 'model: padrão do agente'
      const effort = r.effort && usesEffort(r.model) ? `effort: ${r.effort}` : 'sem effort'
      return `- ${r.task.trim()} → agent: ${ruleAgent(r)}, ${model}, ${effort}`
    })
  const extra = c.extra.trim()
  return [
    '<orquestrador>',
    'Modo orquestrador ligado. Você não executa o trabalho: divide o pedido em etapas, delega cada uma e junta os resultados. Decidir o plano é seu; ler código, escrever, documentar e revisar é de quem recebe a etapa.',
    '',
    `Delegue sempre pela ferramenta ${DELEGATE_TOOL} do servidor MCP "argus", nunca por subagentes próprios. Ela roda a etapa em qualquer agente conectado ao Argus (Claude, Codex, Gemini, Cursor), na mesma pasta, e devolve o que ele entregou. ${LIST_AGENTS_TOOL} mostra os agentes, contas e modelos disponíveis.`,
    '',
    'Em cada etapa, escolha agente, modelo e esforço pela dificuldade daquela etapa, não do pedido inteiro. Use a regra que melhor descrever a etapa e passe o texto dela em rule:',
    ...(rules.length ? rules : ['- (nenhuma regra definida)']),
    `Nenhuma regra serve: decida pelos sinais e escolha entre o que ${LIST_AGENTS_TOOL} mostra. Sobem o nível: decidir em vez de executar, muitos arquivos, pedido ambíguo, mudança difícil de desfazer.`,
    '',
    'Processo:',
    '- Etapas que só leem levam readOnly: true e podem rodar em paralelo. As que alteram arquivos rodam uma de cada vez: o Argus espera a anterior terminar.',
    `- Quem valida nunca é quem executou: outra chamada, de preferência outro agente. Passe em validates o id da etapa validada e, ao ler o veredito, chame ${REPORT_VALIDATION_TOOL}.`,
    '- A validação achou problema: execute de novo com o apontamento e valide outra vez.',
    '- Resultado fraco ou incerto: refaça a etapa um nível acima.',
    '- Quem recebe a etapa não vê esta conversa: passe em task tudo o que ele precisa saber (arquivos, decisões, o que entregar).',
    '- A etapa falhou por limite de uso, conta ou por ficar sem responder (o Argus cancela a etapa muda): refaça em outro agente e avise no fim.',
    '- Pedido simples (uma pergunta, uma conversa): responda direto, sem delegar.',
    '- Ao terminar, liste cada etapa com o agente, o modelo, o esforço e a regra usados.',
    ...(extra ? ['', `Instruções da pessoa: ${extra}`] : []),
    '</orquestrador>'
  ].join('\n')
}

function nativePrompt(c: OrchestratorConfig): string {
  const rules = c.rules
    .filter((r) => r.task.trim() && ruleAgent(r).startsWith('claude'))
    .map((r) => {
      const effort = !usesEffort(r.model) ? 'não passe effort' : r.effort ? `effort: ${r.effort}` : 'não passe effort'
      return `- ${r.task.trim()} → model: ${r.model ? agentAlias(r.model) : 'não passe model'}, ${effort}`
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
