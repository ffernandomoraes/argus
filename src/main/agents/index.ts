import { mkdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { agentProviderName, isAgentProvider, type AgentDef, type AgentProvider, type AgentSaveRequest, type AgentSaveResult } from '../../shared/agents'
import { exists } from '../files/fsHelpers'
import { isReservedOnWindows } from '../files/names'
import { writeTextFile } from '../files/textFile'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { agentExt, findByName, globalDir, projectDir, readDir } from './folder'
import { serializeAgent, serializeCodexAgent } from './format'

// Nome vira o arquivo e o @nome no chat: minúsculas, números e hífen.
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

// Mesmo arquivo no disco do macOS e do Windows, que não diferenciam maiúsculas.
const sameFile = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// Globais e, com uma pasta, também os do projeto. Mesmo nome nos dois: vale o do projeto,
// como no Claude Code.
export async function listAgents(provider: AgentProvider, projectPath?: string): Promise<AgentDef[]> {
  if (!isAgentProvider(provider)) return []
  const global = await readDir(provider, globalDir(provider, projectPath), 'global')
  if (!projectPath) return global
  const local = await readDir(provider, projectDir(provider, projectPath), 'project')
  const names = new Set(local.map((a) => a.name))
  return [...local, ...global.filter((a) => !names.has(a.name))]
}

function invalid(provider: AgentProvider, req: AgentSaveRequest, name: string): string | null {
  if (!NAME.test(name))
    return tr(
      'Use só letras minúsculas, números e hífen no nome (ex.: clone-de-paginas).',
      'Use only lowercase letters, numbers and hyphens in the name (e.g. page-cloner).'
    )
  // O arquivo do agente leva o nome: no Windows, "con", "nul", "com1"... não podem ser arquivo.
  if (isReservedOnWindows(name)) return tr(`O Windows reserva o nome ${name}. Escolha outro.`, `Windows reserves the name ${name}. Choose another one.`)
  if (!req.description.trim())
    return tr(
      `Escreva quando usar este agente: o ${agentProviderName(provider)} decide por essa descrição.`,
      `Describe when to use this agent: ${agentProviderName(provider)} decides based on this description.`
    )
  if (!req.prompt.trim()) return tr('Escreva as instruções do agente.', 'Write the agent’s instructions.')
  // Cada um vai numa linha do cabeçalho: uma quebra de linha criaria outro campo.
  if ([...(req.tools ?? []), req.model ?? ''].some((v) => /[\r\n]/.test(v)))
    return tr('Ferramentas e modelo não podem ter quebra de linha.', 'Tools and model can’t contain line breaks.')
  return null
}

export async function saveAgent(provider: AgentProvider, req: AgentSaveRequest): Promise<AgentSaveResult> {
  if (!isAgentProvider(provider)) return { ok: false, error: tr('Agente desconhecido.', 'Unknown agent.') }
  const name = req.name.trim()
  const error = invalid(provider, req, name)
  if (error) return { ok: false, error }

  const dir = globalDir(provider)
  const ext = agentExt(provider)
  const agents = await readDir(provider, dir, 'global')
  // O arquivo de antes da edição, achado na pasta pelo nome do cabeçalho: o nome que veio da tela
  // nunca vira caminho ("../../Documents/tese" apagaria um arquivo fora da pasta).
  const previous = req.previousName ? findByName(agents, req.previousName, ext) : undefined
  const renamed = !previous || previous.name !== name
  const path = renamed ? join(dir, `${name}${ext}`) : previous.path
  if (renamed) {
    if (agents.some((a) => a !== previous && a.name === name)) return { ok: false, error: tr(`Já existe um agente chamado ${name}.`, `An agent named ${name} already exists.`) }
    // Um arquivo com esse nome que não é deste agente (escrito à mão, sem cabeçalho) não é sobrescrito.
    if ((!previous || !sameFile(previous.path, path)) && (await exists(path))) {
      return { ok: false, error: tr(`Já existe um arquivo ${name}${ext} na pasta de agentes.`, `A file named ${name}${ext} already exists in the agents folder.`) }
    }
  }
  // Ferramentas só no Claude: os nomes mudam de um agente para outro (o Gemini recusa o que não
  // conhece). O Cursor, que recebe o agente no texto da mensagem, também não usa o modelo.
  const data = { ...req, name, tools: provider === 'claude' ? req.tools : undefined, model: provider === 'cursor' ? undefined : req.model }
  try {
    // Só a caixa muda ("Revisor" → "revisor"): no Mac e no Windows é o mesmo arquivo. Renomeia
    // antes de gravar; gravar o novo e apagar o antigo apagaria o próprio agente.
    if (previous && renamed && sameFile(previous.path, path)) await rename(previous.path, path)
    await mkdir(dir, { recursive: true })
    await writeTextFile(path, provider === 'codex' ? serializeCodexAgent(data) : serializeAgent(data))
    if (previous && renamed && !sameFile(previous.path, path)) await unlink(previous.path).catch(() => undefined)
  } catch (err) {
    return { ok: false, error: tr(`Não consegui salvar: ${errorMessage(err)}`, `Couldn’t save: ${errorMessage(err)}`) }
  }
  return { ok: true, agent: { ...data, description: data.description.trim(), prompt: data.prompt.trim(), scope: 'global', path } }
}

// Pelo nome do cabeçalho, que pode diferir do nome do arquivo (agente escrito à mão).
export async function removeAgent(provider: AgentProvider, name: string): Promise<boolean> {
  if (!isAgentProvider(provider) || typeof name !== 'string' || !name) return false
  const agent = findByName(await readDir(provider, globalDir(provider), 'global'), name, agentExt(provider))
  if (!agent) return false
  try {
    await unlink(agent.path)
    return true
  } catch {
    return false
  }
}
