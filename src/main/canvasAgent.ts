import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { createSdkMcpServer, query, tool, type Query } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { CanvasAgentState, CanvasToolCall, CanvasToolResult } from '../shared/canvasAgent'
import { loadCanvas } from './canvasStore'
import { claudeEnv, Inbox } from './chats'
import { claudePath } from './claudePath'
import { expandHome } from './paths'
import { IS_WIN } from './platform'

// Comandos de canvas são simples: o Haiku responde rápido, o que conta muito na voz.
const MODEL = 'haiku'

// Sem pedido por um tempo, a sessão fecha: o próximo comando começa sem a conversa antiga.
const IDLE_CLOSE_MS = 15 * 60_000

// A janela do canvas tem esse tempo para executar a ação (inclui escolher pasta no seletor).
const CALL_TIMEOUT_MS = 3 * 60_000

// O que muda no texto entre os sistemas: o nome dele e a tecla de desfazer.
const SYSTEM_NAME = IS_WIN ? 'Windows' : 'macOS'
const UNDO = IS_WIN ? 'Ctrl+Z' : '⌘Z'

const SYSTEM_PROMPT = `Você é o assistente do canvas de um app de ${SYSTEM_NAME} que organiza projetos do Claude Code.
O canvas tem blocos:
- grupo: área colorida com nome, que contém outros blocos;
- pasta: um projeto (uma pasta do disco) com as conversas do Claude;
- terminal: um terminal rodando o claude numa pasta.

A pessoa pede coisas curtas, por voz ou texto. A transcrição de voz erra nomes: aceite nomes aproximados.

Como agir:
- Sempre chame ver_canvas antes de agir, para saber ids, nomes e posições atuais. Não confie em posições de pedidos anteriores.
- Coordenadas absolutas em pixels: x cresce para a direita, y para baixo. Deixe uns 40px entre blocos.
- Para enfileirar, ordenar ou alinhar vários blocos, prefira organizar_em_grade a calcular posições uma a uma.
- Execute direto, inclusive exclusões: tudo pode ser desfeito com ${UNDO}.
- Pedido ambíguo (dois blocos com nome parecido, grupo que não existe): pergunte em uma frase curta, sem agir.
- Nova pasta com nome falado: use procurar_pasta. Um resultado: use. Vários: pergunte qual. Nenhum, ou sem nome: chame adicionar_pasta sem caminho, que abre o seletor de pastas do ${SYSTEM_NAME}.
- Você só mexe no canvas. Não lê arquivos, não roda comandos e não conversa com as sessões do Claude.

Resposta: português do Brasil, uma frase curta dizendo o que fez (ou a pergunta). Sem markdown. Se excluiu algo, lembre que ${UNDO} desfaz.`

const WINDOWS_ROOTS = [join('OneDrive', 'Desktop'), join('OneDrive', 'Documents'), join('source', 'repos')]
const NO_DIR = /^(\.|node_modules$|Library$|Applications$|Pictures$|Music$|Movies$|AppData$)/

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_.-]+/g, '')

const display = (path: string) => {
  const home = homedir()
  return path === home || path.startsWith(home + sep) ? '~' + path.slice(home.length) : path
}

// Procura pastas pelo nome nos lugares onde costuma haver projeto, até 3 níveis abaixo.
function findFolders(name: string): string[] {
  const home = homedir()
  const wanted = normalize(name)
  // Pais das pastas que já estão no canvas: projetos novos costumam ficar ao lado.
  const saved = loadCanvas()
  const known = Array.isArray(saved)
    ? (saved as { type?: string; data?: { path?: string } }[])
        .filter((n) => n.type === 'project' && n.data?.path)
        .map((n) => dirname(expandHome(n.data!.path!)))
    : []
  const roots = [
    ...new Set([
      ...known,
      // No Windows a Área de Trabalho e os Documentos costumam estar dentro do OneDrive, e o Visual
      // Studio cria os projetos em source\repos.
      ...['Desktop', 'Documents', 'Developer', 'Projects', 'projects', 'code', 'dev', ...(IS_WIN ? WINDOWS_ROOTS : [])].map((d) =>
        join(home, d)
      )
    ])
  ]
  const found = new Set<string>()
  const seen = new Set<string>()
  let queue = roots.map((path) => ({ path, depth: 0 }))
  let visited = 0
  while (queue.length && visited < 6000 && found.size < 10) {
    const next: typeof queue = []
    for (const { path, depth } of queue) {
      if (seen.has(path)) continue
      seen.add(path)
      visited++
      let entries: string[]
      try {
        entries = readdirSync(path, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !NO_DIR.test(e.name))
          .map((e) => e.name)
      } catch {
        continue
      }
      for (const entry of entries) {
        const full = join(path, entry)
        if (normalize(entry).includes(wanted)) found.add(full)
        if (depth < 2) next.push({ path: full, depth: depth + 1 })
      }
    }
    queue = next
  }
  return [...found].map(display)
}

function isDir(path: string): boolean {
  try {
    return statSync(expandHome(path)).isDirectory()
  } catch {
    return false
  }
}

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] })
const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })

const id = z.string().describe('id do bloco, como aparece em ver_canvas')

// Uma sessão do Claude só com ferramentas do canvas. A janela do canvas executa as ações,
// porque é ela que tem o estado dos blocos (e o desfazer).
export class CanvasAgent {
  state: CanvasAgentState = { status: 'idle', reply: '' }
  private session: { q: Query; inbox: Inbox } | null = null
  private pending = new Map<string, { resolve: (r: CanvasToolResult) => void; timer: NodeJS.Timeout }>()
  private idleTimer: NodeJS.Timeout | null = null

  constructor(
    private target: () => Electron.WebContents | null,
    private onState: (state: CanvasAgentState) => void
  ) {}

  private update(patch: Partial<CanvasAgentState>): void {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }

  // Pede à janela do canvas para executar a ação e espera a resposta.
  private call(name: string, args: Record<string, unknown>): Promise<CanvasToolResult> {
    const wc = this.target()
    if (!wc || wc.isDestroyed()) return Promise.resolve({ id: '', text: 'O canvas não está aberto.', error: true })
    const call: CanvasToolCall = { id: crypto.randomUUID(), name, args }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(call.id)
        resolve({ id: call.id, text: 'O canvas não respondeu a tempo.', error: true })
      }, CALL_TIMEOUT_MS)
      this.pending.set(call.id, { resolve, timer })
      wc.send('canvasAgent:call', call)
    })
  }

  result(r: CanvasToolResult): void {
    const p = this.pending.get(r.id)
    if (!p) return
    clearTimeout(p.timer)
    this.pending.delete(r.id)
    p.resolve(r)
  }

  // Ferramenta executada pela janela do canvas; o rótulo aparece na barra enquanto roda.
  private forward = (name: string, label: string) => async (args: Record<string, unknown>) => {
    this.update({ activity: label })
    const r = await this.call(name, args)
    return r.error ? fail(r.text) : ok(r.text)
  }

  private tools() {
    const f = this.forward
    return [
      tool(
        'ver_canvas',
        'Lista todos os blocos do canvas (grupos, pastas, terminais) com id, nome, posição e tamanho absolutos, e a área visível da tela.',
        {},
        f('ver_canvas', 'Olhando o canvas')
      ),
      tool(
        'mover',
        'Move um ou mais blocos para posições absolutas (canto superior esquerdo). Bloco dentro de grupo continua no grupo; o grupo cresce se precisar.',
        { itens: z.array(z.object({ id, x: z.number(), y: z.number() })).min(1) },
        f('mover', 'Movendo blocos')
      ),
      tool(
        'organizar_em_grade',
        'Arruma blocos em grade, na ordem dada (esquerda para direita, depois a próxima linha). Os blocos precisam estar no mesmo grupo, ou todos soltos. Dentro de grupo, a grade começa no canto do grupo e o grupo se ajusta ao conteúdo.',
        {
          ids: z.array(z.string()).min(1).describe('ids na ordem desejada'),
          colunas: z.number().int().min(1).optional().describe('blocos por linha; padrão: todos numa linha só'),
          x: z.number().optional().describe('só para blocos soltos: onde começa a grade; padrão: onde está o primeiro'),
          y: z.number().optional()
        },
        f('organizar_em_grade', 'Organizando blocos')
      ),
      tool(
        'criar_grupo',
        'Cria um grupo vazio. Sem posição, fica no centro da tela.',
        {
          nome: z.string(),
          cor: z.string().optional().describe('hex da paleta: #3b82f6 azul, #8b5cf6 roxo, #ec4899 rosa, #ef4444 vermelho, #f59e0b laranja, #10b981 verde, #06b6d4 ciano, #71717a cinza'),
          x: z.number().optional(),
          y: z.number().optional(),
          largura: z.number().optional(),
          altura: z.number().optional()
        },
        f('criar_grupo', 'Criando grupo')
      ),
      tool(
        'procurar_pasta',
        'Procura pastas no disco pelo nome (Desktop, Documentos e perto das pastas que já estão no canvas). Devolve caminhos.',
        { nome: z.string() },
        async ({ nome }) => {
          this.update({ activity: 'Procurando pasta' })
          const found = findFolders(nome)
          return ok(found.length ? found.join('\n') : 'Nenhuma pasta encontrada com esse nome.')
        }
      ),
      tool(
        'adicionar_pasta',
        `Adiciona uma pasta de projeto ao canvas. Sem caminho, abre o seletor de pasta do ${SYSTEM_NAME} para a pessoa escolher.`,
        {
          caminho: z.string().optional().describe('caminho absoluto ou começando com ~/'),
          grupo_id: z.string().optional().describe('grupo onde a pasta entra'),
          x: z.number().optional(),
          y: z.number().optional()
        },
        async (args) => {
          if (args.caminho && !isDir(args.caminho)) return fail(`A pasta ${args.caminho} não existe.`)
          return f('adicionar_pasta', args.caminho ? 'Adicionando pasta' : 'Esperando você escolher a pasta')(args)
        }
      ),
      tool(
        'abrir_terminal',
        'Abre um terminal com o claude numa pasta.',
        {
          caminho: z.string().describe('pasta onde o terminal abre; pode ser o caminho de uma pasta do canvas'),
          grupo_id: z.string().optional(),
          x: z.number().optional(),
          y: z.number().optional()
        },
        async (args) => {
          if (!isDir(args.caminho)) return fail(`A pasta ${args.caminho} não existe.`)
          return f('abrir_terminal', 'Abrindo terminal')(args)
        }
      ),
      tool(
        'mover_para_grupo',
        'Coloca uma pasta ou terminal dentro de um grupo (num lugar livre), ou tira do grupo com grupo_id null.',
        { id, grupo_id: z.string().nullable() },
        f('mover_para_grupo', 'Mudando de grupo')
      ),
      tool('renomear', 'Renomeia um bloco.', { id, nome: z.string() }, f('renomear', 'Renomeando')),
      tool(
        'excluir',
        'Exclui um bloco. Grupo: por padrão exclui junto o que está dentro; com manter_conteudo, o conteúdo fica solto no canvas. Terminal: encerra o processo. Pasta: só sai do canvas, nada é apagado do disco.',
        { id, manter_conteudo: z.boolean().optional() },
        f('excluir', 'Excluindo')
      ),
      tool(
        'recolher_grupo',
        'Recolhe (só a barra do título) ou expande um grupo.',
        { id, recolhido: z.boolean() },
        f('recolher_grupo', 'Recolhendo grupo')
      ),
      tool(
        'cor_do_grupo',
        'Muda a cor de um grupo. Use um hex da paleta de criar_grupo.',
        { id, cor: z.string() },
        f('cor_do_grupo', 'Mudando cor')
      ),
      tool(
        'ajustar_grupo',
        'Redimensiona o grupo para caber exatamente no que está dentro.',
        { id },
        f('ajustar_grupo', 'Ajustando grupo')
      ),
      tool(
        'focar',
        'Move a câmera para mostrar os blocos indicados. Sem ids, mostra o canvas todo.',
        { ids: z.array(z.string()).optional() },
        f('focar', 'Ajustando a visão')
      )
    ]
  }

  private open(): { q: Query; inbox: Inbox } {
    if (this.session) return this.session
    const claude = claudePath()
    const inbox = new Inbox()
    const server = createSdkMcpServer({ name: 'canvas', tools: this.tools(), alwaysLoad: true })
    const q = query({
      prompt: inbox,
      options: {
        cwd: homedir(),
        pathToClaudeCodeExecutable: claude,
        env: claudeEnv(claude),
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        // Só as ferramentas do canvas: nada de arquivos, terminal, CLAUDE.md ou MCPs da pessoa.
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        mcpServers: { canvas: server },
        canUseTool: async (_name, input) => ({ behavior: 'allow', updatedInput: input }),
        persistSession: false
      }
    })
    const session = { q, inbox }
    this.session = session
    void this.run(session)
    return session
  }

  private async run(session: { q: Query; inbox: Inbox }): Promise<void> {
    try {
      for await (const m of session.q) {
        if (m.type === 'result') {
          const failed = m.subtype !== 'success' || m.is_error
          const text = 'result' in m ? m.result : ''
          this.update({
            status: 'idle',
            activity: undefined,
            reply: failed ? '' : text,
            error: failed ? text || 'O Claude parou com erro.' : undefined
          })
        }
      }
    } catch (err) {
      this.update({ status: 'idle', activity: undefined, error: (err as Error).message })
    } finally {
      if (this.session === session) this.session = null
      if (this.state.status === 'running') this.update({ status: 'idle', activity: undefined })
    }
  }

  send(text: string): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.close(), IDLE_CLOSE_MS)
    this.update({ status: 'running', reply: '', activity: undefined, error: undefined })
    this.open().inbox.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null })
  }

  async interrupt(): Promise<void> {
    try {
      await this.session?.q.interrupt()
    } catch {
      // já parado
    }
    this.update({ status: 'idle', activity: undefined })
  }

  close(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.pending.forEach((p, id) => {
      clearTimeout(p.timer)
      p.resolve({ id, text: 'Cancelado.', error: true })
    })
    this.pending.clear()
    const s = this.session
    this.session = null
    if (!s) return
    s.inbox.close()
    s.q.close()
  }
}
