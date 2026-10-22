import { createSdkMcpServer, tool, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { Terminals } from '.'

// Servidor de ferramentas do próprio Argus em cada conversa. Fica fora da lista de MCPs da tela
// (chats/mcpStatus.ts): não é um MCP da pessoa.
export const ARGUS_MCP = 'argus'
const TYPE_TOOL = 'digitar_no_terminal'
const RUN_TOOL = 'rodar_no_terminal'
// Só a de digitar é liberada sem perguntar: quem aperta Enter é a pessoa. A de rodar pede permissão
// como o Bash do Claude (no modo sem permissões, roda direto).
export const ARGUS_ALLOWED_TOOLS = [`mcp__${ARGUS_MCP}__${TYPE_TOOL}`]

// typed: avisa o terminal que a conversa digitou nele. open: pede ao drawer da conversa que abra o
// terminal dele (fechado, ou ainda nem aberto).
type Host = { terminals: Terminals; typed: (key: string) => void; open: (conversations: string[]) => void }

// Quanto esperar o drawer abrir o terminal e o shell subir (o zsh de login leva um instante).
const OPEN_TIMEOUT_MS = 8_000
const OPEN_POLL_MS = 100

// Shell aberto embaixo de cada conversa no drawer (ver DrawerTerminal na interface), pela chave da
// conversa (o id dela no app e o da sessão). Só enquanto o painel está à vista.
const links = new Map<string, string>()
let host: Host | null = null

export function initDrawerShells(h: Host): void {
  host = h
}

export function linkDrawerShell(key: string, conversations: string[]): void {
  for (const c of conversations) links.set(c, key)
}

export function unlinkDrawerShell(key: string): void {
  for (const [c, k] of links) if (k === key) links.delete(c)
}

const reply = (text: string, isError = false) => ({ content: [{ type: 'text' as const, text }], ...(isError && { isError }) })

// Terminal à vista da conversa, com o shell rodando.
function shellOf(conversations: string[], h: Host): string | null {
  const key = conversations.map((c) => links.get(c)).find(Boolean)
  return key && h.terminals.has(key) ? key : null
}

// Sem terminal à vista, pede ao drawer que abra o dele e espera o shell subir. Conferido aos poucos:
// a ligação chega da tela e o processo sobe depois, cada um no seu tempo.
async function openShell(conversations: string[], h: Host): Promise<string | null> {
  const ready = shellOf(conversations, h)
  if (ready) return ready
  h.open(conversations)
  const deadline = Date.now() + OPEN_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, OPEN_POLL_MS))
    const key = shellOf(conversations, h)
    if (key) return key
  }
  return null
}

// Digita o comando no shell da conversa; com `run`, aperta Enter também. Uma linha só: uma quebra
// de linha no meio rodaria a primeira parte sem a pessoa conferir.
async function typeCommand(conversations: string[], command: string, run: boolean) {
  const text = command.replace(/[\r\n]+$/, '')
  if (/[\r\n]/.test(text)) return reply('O comando precisa ser de uma linha só. Junte as partes com && ou ;.', true)
  const key = host && (await openShell(conversations, host))
  if (!host || !key)
    return reply(
      'Não consegui abrir o terminal desta conversa: ele só existe no painel da conversa aberta no canvas (não na janela separada nem no bloco do canvas), ou o shell foi encerrado. Peça para a pessoa abrir pelo botão de terminal, acima da caixa de escrever.',
      true
    )
  host.terminals.write(key, run ? text + '\r' : text)
  host.typed(key)
  return reply(
    run
      ? 'Comando enviado no terminal. Você não vê a saída; se precisar dela, peça para a pessoa contar.'
      : 'Digitado no terminal, sem Enter: a pessoa confere e roda. Você não vê a saída; se precisar dela, peça.'
  )
}

// conversations: as chaves da conversa que chama, lidas na hora (a nova ganha o id da sessão depois).
// extra: outras ferramentas do Argus na mesma conversa (as do orquestrador, ver orchestration/).
export function argusMcp(conversations: () => Iterable<string>, extra: SdkMcpToolDefinition<any>[] = []) {
  return createSdkMcpServer({
    name: ARGUS_MCP,
    alwaysLoad: true,
    tools: [
      tool(
        TYPE_TOOL,
        'Digita um comando no terminal (shell do sistema) embaixo desta conversa no Argus, sem apertar Enter: a pessoa confere e roda. Se o terminal estiver fechado, ele abre sozinho. Use quando ela pedir para digitar algo no terminal dela sem rodar (para rodar, use rodar_no_terminal). O terminal pode estar dentro de um ssh. Você não vê a saída; se precisar, peça para ela contar. Uma linha só; para vários passos, junte com &&.',
        { comando: z.string().min(1).describe('o comando, em uma linha') },
        async ({ comando }) => typeCommand([...conversations()], comando, false)
      ),
      tool(
        RUN_TOOL,
        'Digita e roda (aperta Enter) um comando no terminal (shell do sistema) embaixo desta conversa no Argus. Se o terminal estiver fechado, ele abre sozinho. Use quando a pessoa pedir para rodar ou executar algo no terminal dela, como conectar por ssh numa VPS ou um comando que depende do .env ou de credenciais dela. Se ela pedir só para digitar, ou se o comando for destrutivo, use digitar_no_terminal. O terminal pode estar dentro de um ssh. Você não vê a saída; se precisar, peça para ela contar. Uma linha só; para vários passos, junte com &&.',
        { comando: z.string().min(1).describe('o comando, em uma linha') },
        async ({ comando }) => typeCommand([...conversations()], comando, true)
      ),
      ...extra
    ]
  })
}
