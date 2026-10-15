import type { AgentDef, AgentSaveRequest } from '../../shared/agents'

// O arquivo .md de um agente: cabeçalho (name, description, tools, model) e as instruções no
// corpo. Lógica pura.

// Valor do cabeçalho: entre aspas (como o app grava) ou cru (como muita gente escreve à mão).
function scalar(raw: string): string {
  const v = raw.trim()
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v)
    } catch {
      // aspas mal fechadas: segue cru
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")
  return v
}

export function parseAgent(raw: string, path: string, scope: AgentDef['scope']): AgentDef | null {
  // Arquivo editado no Windows vem com \r\n.
  const text = raw.replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const head: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (kv) head[kv[1]] = scalar(kv[2])
  }
  if (!head.name) return null
  const tools = head.tools
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    name: head.name,
    description: head.description ?? '',
    prompt: m[2].trim(),
    tools: tools?.length ? tools : undefined,
    model: head.model && head.model !== 'inherit' ? head.model : undefined,
    scope,
    path
  }
}

// Aspas duplas no padrão JSON são YAML válido: descrição com ":" ou "#" não quebra o cabeçalho.
// Ferramentas e modelo vão crus, cada um numa linha (ver saveAgent, que recusa quebra de linha).
export function serializeAgent(a: AgentSaveRequest): string {
  const head = [
    `name: ${a.name}`,
    `description: ${JSON.stringify(a.description.replace(/\s*\n\s*/g, ' ').trim())}`,
    ...(a.tools?.length ? [`tools: ${a.tools.join(', ')}`] : []),
    ...(a.model ? [`model: ${a.model}`] : [])
  ]
  return `---\n${head.join('\n')}\n---\n\n${a.prompt.trim()}\n`
}

// ---------- Codex: .toml ----------
// name, description, developer_instructions e model, no nível de cima do arquivo. Outros campos
// (sandbox_mode, tabelas) são ignorados ao ler. Um TOML mínimo: só o que um agente usa.

const ESCAPES: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }

// Escapes da string básica do TOML ("..." e """..."""); \u e \U viram o caractere.
function unescapeBasic(s: string): string {
  return s
    .replace(/\\[ \t]*\n\s*/g, '')
    .replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (m, e: string) =>
      e.length > 1 ? String.fromCodePoint(parseInt(e.slice(1), 16)) : (ESCAPES[e] ?? m)
    )
}

// Chaves de cima do arquivo, até a primeira [tabela]. Strings de uma linha ou de várias.
export function tomlTop(raw: string): Record<string, string> {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: Record<string, string> = {}
  for (let n = 0; n < lines.length; n++) {
    if (/^\s*\[/.test(lines[n])) break
    const kv = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(lines[n])
    if (!kv) continue
    const [, key, value] = kv
    const quote = value.startsWith('"""') ? '"""' : value.startsWith("'''") ? "'''" : null
    if (quote) {
      let body = value.slice(3)
      let end = body.indexOf(quote)
      while (end < 0 && n + 1 < lines.length) {
        body += '\n' + lines[++n]
        end = body.indexOf(quote)
      }
      if (end >= 0) body = body.slice(0, end)
      // A quebra logo depois das aspas de abertura não conta.
      if (body.startsWith('\n')) body = body.slice(1)
      out[key] = quote === '"""' ? unescapeBasic(body) : body
      continue
    }
    const basic = /^"((?:[^"\\]|\\.)*)"/.exec(value)
    if (basic) out[key] = unescapeBasic(basic[1])
    else if (value.startsWith("'")) out[key] = value.slice(1, Math.max(1, value.indexOf("'", 1)))
    else out[key] = value.replace(/\s+#.*$/, '').trim()
  }
  return out
}

export function parseCodexAgent(raw: string, path: string, scope: AgentDef['scope']): AgentDef | null {
  const head = tomlTop(raw)
  if (!head.name) return null
  return {
    name: head.name,
    description: head.description ?? '',
    prompt: (head.developer_instructions ?? '').trim(),
    model: head.model || undefined,
    scope,
    path
  }
}

// Instruções numa string literal de várias linhas ('''), que não tem escapes: fica legível para
// quem abre o arquivo. Com ''' no próprio texto, vai como string básica de uma linha.
export function serializeCodexAgent(a: AgentSaveRequest): string {
  const prompt = a.prompt.trim()
  const head = [
    `name = ${JSON.stringify(a.name)}`,
    `description = ${JSON.stringify(a.description.replace(/\s*\n\s*/g, ' ').trim())}`,
    ...(a.model ? [`model = ${JSON.stringify(a.model)}`] : [])
  ]
  const body = prompt.includes("'''") ? JSON.stringify(prompt) : `'''\n${prompt}\n'''`
  return `${head.join('\n')}\ndeveloper_instructions = ${body}\n`
}
