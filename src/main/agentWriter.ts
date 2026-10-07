import { homedir } from 'node:os'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { AgentDraftFields, AgentDraftRequest, AgentDraftResult } from '../shared/agents'
import { claudeEnv } from './chats'
import { claudePath } from './claudePath'

// Escrever boas instruções pede mais que o Haiku; o Sonnet ainda responde em poucos segundos.
const MODEL = 'sonnet'

const SYSTEM_PROMPT = `Você escreve agentes (subagentes) do Claude Code a partir do que a pessoa conta, quase sempre por voz.
A transcrição de voz erra palavras e nomes: entenda a intenção.

O agente é global: vale em qualquer projeto. Ele não vê a conversa de quem o chamou, só o pedido que recebe;
então as instruções precisam dizer como descobrir o contexto do projeto (ler a stack, os padrões e os componentes
existentes) em vez de supor uma stack fixa, a menos que a pessoa peça uma.

Campos:
- name: identificador curto em minúsculas com hífen, em português (ex.: clone-de-paginas).
- description: uma frase dizendo o que o agente faz e quando usá-lo. O Claude principal decide delegar por ela.
- prompt: as instruções do agente, em português do Brasil, em segunda pessoa ("Você..."). Comece pelo papel,
  depois o passo a passo de trabalho, as ferramentas que deve usar (ex.: MCP do Playwright para abrir páginas e
  tirar prints), como conferir o resultado e o que entregar no relatório final. Markdown simples. Sem inventar
  requisitos que a pessoa não pediu.
- model: "" (o mesmo da conversa) a menos que a pessoa peça um modelo; aí "opus", "sonnet" ou "haiku".

Se vierem campos atuais, o pedido é um ajuste: mantenha o que não foi pedido para mudar e devolva todos os campos.`

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    prompt: { type: 'string' },
    model: { type: 'string', enum: ['', 'opus', 'sonnet', 'haiku'] }
  },
  required: ['name', 'description', 'prompt', 'model'],
  additionalProperties: false
}

const DRAFT_TIMEOUT_MS = 3 * 60_000

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

// Pede ao Claude os campos de um agente. Sessão avulsa, sem ferramentas nem configurações da
// pessoa: ele só escreve.
export async function draftAgent(req: AgentDraftRequest): Promise<AgentDraftResult> {
  const brief = req.brief.trim()
  if (!brief) return { ok: false, error: 'Conte o que o agente deve fazer.' }
  const current = req.current && (req.current.description || req.current.prompt) ? req.current : undefined
  const prompt = current
    ? `Campos atuais do agente:\n${JSON.stringify(current, null, 2)}\n\nMudança pedida:\n${brief}`
    : `Agente novo. O que a pessoa contou:\n${brief}`

  const claude = claudePath()
  const q = query({
    prompt,
    options: {
      cwd: homedir(),
      pathToClaudeCodeExecutable: claude,
      env: claudeEnv(claude),
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      outputFormat: { type: 'json_schema', schema: SCHEMA }
    }
  })
  const timer = setTimeout(() => q.close(), DRAFT_TIMEOUT_MS)
  try {
    for await (const m of q) {
      if (m.type !== 'result') continue
      const out = m.subtype === 'success' ? (m.structured_output as AgentDraftFields | undefined) : undefined
      if (!out?.prompt) return { ok: false, error: 'O Claude não conseguiu montar o agente. Tente descrever de novo.' }
      return {
        ok: true,
        fields: {
          name: slug(out.name) || current?.name || '',
          description: out.description.trim(),
          prompt: out.prompt.trim(),
          model: out.model || undefined
        }
      }
    }
    return { ok: false, error: 'Demorou demais para responder. Tente de novo.' }
  } catch (err) {
    return { ok: false, error: `Não consegui falar com o Claude: ${(err as Error).message}` }
  } finally {
    clearTimeout(timer)
    q.close()
  }
}
