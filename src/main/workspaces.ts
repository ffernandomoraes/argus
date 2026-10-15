import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { app } from 'electron'
import { expandHome } from './paths'
import { IS_WIN } from './platform'
import { distroFor, ensureDistro, homeUnc, parseWslPath, toLinux, toUnc } from './wsl'

// Workspace: várias pastas de projeto, todas iguais. As conversas e terminais dele abrem numa pasta
// do Argus (uma por workspace, fora das pastas da pessoa) e recebem as pastas do workspace como
// pastas adicionais. O histórico fica preso a essa pasta: pôr ou tirar pasta não perde conversa.
// Como o workspace sem nome do VS Code, que também é uma pasta nos dados dele.

const ID = /^[0-9a-f-]{36}$/
// Mesma raiz da pasta de apoio do Argus no WSL (wsl/run.ts).
const WSL_ROOT = app.isPackaged ? '.argus/workspaces' : '.argus-dev/workspaces'

// Onde a pasta de um workspace novo nasce. Quem decide onde o agente roda é a pasta (wsl/index.ts):
// com todas as pastas na mesma distro do WSL, ela fica no Linux dessa distro, e tudo roda lá (com os
// caminhos do Linux). Senão, nos dados do app (no Mac, Linux e Windows). A pasta do usuário no Linux
// vem da distro (ensureDistro); sem resposta dela, o palpite pelo caminho (/home/<usuário>).
async function newWorkspaceDir(id: string, folders: string[]): Promise<string> {
  if (IS_WIN) {
    const wsl = folders.map((f) => parseWslPath(expandHome(f)))
    const distro = wsl[0]?.distro
    if (distro && wsl.every((w) => w?.distro === distro)) {
      const info = await ensureDistro(distro).catch(() => null)
      const home = info?.home ? toUnc(distro, info.home) : homeUnc(distro, wsl[0]!.linux)
      if (home) return join(home, WSL_ROOT, id)
    }
  }
  return join(app.getPath('userData'), 'workspaces', id)
}

// Pasta de workspace (…/workspaces/<uuid>): só nela se escreve (o caminho vem da janela), e ela não
// entra na lista de pastas com conversa do "Nova pasta" (sessions/knownFolders.ts).
export function isWorkspaceDir(dir: string): boolean {
  return ID.test(basename(dir)) && basename(dirname(dir)) === 'workspaces'
}

// O aviso que cada agente lê sozinho ao abrir na pasta (CLAUDE.md, AGENTS.md do Codex e do Cursor,
// GEMINI.md): onde ele está e quais pastas são do workspace. O que cada projeto tem (MCP,
// configurações) ele descobre lendo o projeto. Agente rodando no WSL: os caminhos do Linux, que são
// os que ele enxerga lá dentro (C:\ vira /mnt/c).
function instructions(folders: string[], inWsl: boolean): string {
  const list = folders.map((f) => `- ${inWsl ? toLinux(expandHome(f)) : expandHome(f)}`).join('\n')
  return `# Workspace

This folder is only the Argus workspace anchor: it has no project files. The work happens in the
workspace folders below, which are equally important and may be separate git repositories (each
with its own branch, settings and tools). Check which folder a file belongs to before running git
or project commands, and run them from that folder.

${list}
`
}

// Cria a pasta de um workspace novo (sem `dir`) ou atualiza a de um existente, com o aviso das
// pastas. Devolve o caminho dela.
export async function syncWorkspace(folders: string[], dir?: string): Promise<string> {
  const target = dir ? expandHome(dir) : await newWorkspaceDir(randomUUID(), folders)
  if (!isWorkspaceDir(target)) throw new Error(`Pasta de workspace inválida: ${dir}`)
  mkdirSync(target, { recursive: true })
  const text = instructions(folders, !!distroFor(target))
  for (const name of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) writeFileSync(join(target, name), text)
  // O Gemini não lê o GEMINI.md das pastas adicionais sem isto (o Claude tem a opção equivalente,
  // FOLDERS_CLAUDE_MD). Configuração do workspace: só vale com a pasta confiável (trustGemini).
  mkdirSync(join(target, '.gemini'), { recursive: true })
  writeFileSync(join(target, '.gemini', 'settings.json'), JSON.stringify({ context: { loadMemoryFromIncludeDirectories: true } }, null, 2))
  return target
}

// O Gemini ignora o GEMINI.md e a configuração de uma pasta que não esteja nas confiáveis dele
// (conferido no código do gemini-cli 0.64: isTrustedFolder() antes de carregar o contexto). A pasta
// do workspace é do Argus e só tem o aviso: entra na lista da conta que vai abrir (`geminiHome`, o
// GEMINI_CLI_HOME dela; sem ele, a pasta do usuário). Outras pastas, nada muda. Arquivo ilegível
// (com comentários, por exemplo) fica como está.
export function trustGemini(cwd: string, geminiHome?: string): void {
  if (!isWorkspaceDir(cwd)) return
  const file = join(geminiHome ?? homedir(), '.gemini', 'trustedFolders.json')
  let trusted: Record<string, string> = {}
  try {
    trusted = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return
  }
  if (trusted[cwd] === 'TRUST_FOLDER') return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ ...trusted, [cwd]: 'TRUST_FOLDER' }, null, 2))
}
