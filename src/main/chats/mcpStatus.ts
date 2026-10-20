import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import { shell } from 'electron'
import { REMOVABLE_SCOPES, type McpAuthResult, type McpServer } from '../../shared/mcp'
import { tr } from '../i18n'
import { ARGUS_MCP } from '../terminals/drawerShells'
import { distroFor } from '../wsl'
import { claudeCodeOptions, claudeLaunch } from './env'
import { Inbox } from './inbox'

function toMcpServers(raw: Awaited<ReturnType<Query['mcpServerStatus']>>): McpServer[] {
  return raw
    // As ferramentas do próprio Argus não são um MCP da pessoa.
    .filter((m) => m.name !== ARGUS_MCP)
    .map((m) => ({
      name: m.name,
      status: m.status,
      tools: m.tools?.length ?? 0,
      error: m.error,
      scope: m.scope,
      source: m.source,
      version: m.serverInfo?.version,
      signOut: m.config?.type === 'http' || m.config?.type === 'sse'
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Logo depois de abrir, vários servidores ainda estão conectando. Pergunta de novo até
// ninguém ficar em "conectando", ou até cansar de esperar.
const MCP_SETTLE_MS = 10_000
const MCP_RETRY_MS = 400

// wait: false devolve como está agora, com os que ainda estão conectando (o painel pergunta de novo).
export async function mcpServersOf(q: Query, wait = true): Promise<McpServer[]> {
  const ask = (): Promise<McpServer[]> => q.mcpServerStatus().then(toMcpServers)
  if (!wait) return ask()
  const deadline = Date.now() + MCP_SETTLE_MS
  let last = await ask()
  while (last.some((m) => m.status === 'pending') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, MCP_RETRY_MS))
    last = await ask()
  }
  return last
}

// Status dos MCPs sem conversa aberta: sobe um `claude` só para perguntar e o encerra.
// Os servidores dependem da pasta e da conta, por isso não dá para usar um processo genérico.
export async function mcpStatusFor(cwd: string, account?: string): Promise<McpServer[]> {
  const inbox = new Inbox()
  const q = query({ prompt: inbox, options: { ...claudeCodeOptions(cwd, account), persistSession: false } })
  try {
    return await mcpServersOf(q)
  } finally {
    inbox.close()
    q.close()
  }
}

// Pedidos de autorização do `claude`: existem no SDK mas ficam fora dos tipos publicados
// (conferido na 0.3.292 com o Claude Code 2.1.303).
type AuthQuery = {
  mcpAuthenticate(name: string): Promise<{ authUrl?: string; callbackExpected?: boolean } | undefined>
  mcpClearAuth(name: string): Promise<unknown>
}

// Começa a autorização de um servidor (o "Autorizar" do painel, como o /mcp do terminal) e abre o
// link no navegador. O `claude` fica esperando a volta e, ao terminar, reconecta sozinho. Conector do
// claude.ai: o link é a página dele no site, sem volta (callbackExpected false). Sem link: já estava
// autorizado.
export async function authenticateMcp(q: Query, name: string): Promise<McpAuthResult> {
  try {
    const start = (await (q as unknown as AuthQuery).mcpAuthenticate(name)) ?? {}
    // Só link da web: o endereço vem do servidor de autorização, de fora do app.
    if (start.authUrl && /^https?:\/\//i.test(start.authUrl)) await shell.openExternal(start.authUrl)
    return { ok: true, manualReconnect: !!start.authUrl && start.callbackExpected === false }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// Apaga o login de um servidor web (http/sse) nesta conta; ele volta a pedir autorização.
export function clearMcpAuth(q: Query, name: string): Promise<void> {
  return (q as unknown as AuthQuery).mcpClearAuth(name).then(() => undefined)
}

const run = promisify(execFile)

// Roda um comando do `claude` com a conta, na pasta; o erro vem com o que ele escreveu.
async function claudeRun(args: string[], account?: string, cwd?: string): Promise<string> {
  const l = await claudeLaunch(args, account, cwd)
  if (!l.ok) throw new Error(l.error)
  try {
    const { stdout } = await run(l.file, l.args, { env: l.env, cwd: l.cwd, timeout: distroFor(cwd) ? 30_000 : 15_000, windowsHide: true })
    return stdout
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string }
    throw new Error((e.stderr || e.stdout || e.message).trim())
  }
}

type InstalledPlugin = { id: string; scope: string; projectPath?: string }

// Servidor de plugin ("plugin:<plugin>:<servidor>") só sai junto com o plugin: desinstala de todo
// lugar onde ele está (conta, pasta), cada um na pasta dele. No WSL, os caminhos do Linux não servem
// de pasta para o app: fica na da conversa.
async function uninstallPlugin(plugin: string, account?: string, cwd?: string): Promise<void> {
  const installed = JSON.parse(await claudeRun(['plugin', 'list', '--json'], account, cwd)) as InstalledPlugin[]
  const found = installed.filter((p) => p.id.split('@')[0] === plugin)
  if (!found.length) throw new Error(tr(`O plugin ${plugin} não está instalado.`, `The ${plugin} plugin isn’t installed.`))
  for (const p of found) {
    const at = p.scope !== 'user' && p.projectPath && !distroFor(cwd) ? p.projectPath : cwd
    await claudeRun(['plugin', 'uninstall', p.id, '--scope', p.scope], account, at)
  }
}

// Tira um servidor da conta: os adicionados no Claude Code pelo `claude mcp remove` (na pasta, que
// decide os de projeto e os locais); os de plugin, desinstalando o plugin. A sessão aberta continua
// com ele até reabrir. Os conectores do claude.ai saem no site (o painel abre a página).
export async function removeMcp(name: string, scope: string, account?: string, cwd?: string): Promise<void> {
  const plugin = scope === 'dynamic' ? name.match(/^plugin:([^:]+):/)?.[1] : undefined
  if (plugin) return uninstallPlugin(plugin, account, cwd)
  if (!REMOVABLE_SCOPES.includes(scope)) throw new Error(`Scope "${scope}" can’t be removed here`)
  await claudeRun(['mcp', 'remove', name, '--scope', scope], account, cwd)
}
