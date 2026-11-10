import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MAIN_DIR } from '../accounts/paths'

// /output-style: o estilo de resposta do Claude Code. Como no `claude`, a escolha vale para a pasta
// e fica no .claude/settings.local.json dela. Vale o primeiro que tiver: local, projeto, usuário.
// Leitura e gravação sem segurar o app: a pasta pode ser do WSL (\\wsl.localhost\...), e síncronas
// elas travavam tudo enquanto o WSL respondia.

async function styleIn(file: string): Promise<string | undefined> {
  try {
    const value = JSON.parse(await readFile(file, 'utf8')).outputStyle
    return typeof value === 'string' && value ? value : undefined
  } catch {
    return undefined
  }
}

const localFile = (cwd: string) => join(cwd, '.claude', 'settings.local.json')

export async function readOutputStyle(cwd: string): Promise<string> {
  return (
    (await styleIn(localFile(cwd))) ??
    (await styleIn(join(cwd, '.claude', 'settings.json'))) ??
    (await styleIn(join(MAIN_DIR, 'settings.json'))) ??
    'default'
  )
}

// Sem conversa aberta: grava direto no arquivo, mantendo o resto. Com ela, quem grava é o próprio
// Claude Code (ChatSession.setOutputStyle), que já aplica na sessão.
export async function writeOutputStyle(cwd: string, style: string): Promise<void> {
  const file = localFile(cwd)
  let current: Record<string, unknown> = {}
  let text: string | null = null
  try {
    text = await readFile(file, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  // Ilegível: o erro sobe, como antes (não grava por cima do que a pessoa escreveu).
  if (text !== null) current = JSON.parse(text)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ ...current, outputStyle: style }, null, 2)}\n`)
}
