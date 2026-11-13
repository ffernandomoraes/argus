import { resolve } from 'node:path'
import { expandHome, inside, realRoot } from '../paths'
import { IS_WIN } from '../platform'
import type { Listening } from '../processScan'

// As formas da pasta do projeto para comparar com a dos processos: a real (o lsof devolve a pasta
// sem atalhos) e a que a pessoa abriu. No Windows, a real de uma unidade mapeada é o caminho de
// rede (\\servidor\pasta), e o servidor cita a letra ("Z:\proj") na linha de comando.
export function rootsOf(path: string): string[] {
  const real = realRoot(path)
  const plain = resolve(expandHome(path))
  return real === plain ? [real] : [real, plain]
}

// Windows: a pasta de outro processo não é informada. O servidor da pasta é o que o botão abriu,
// ou um programa de servidor (node, python...) que cita a pasta na linha de comando (o node do
// vite roda "C:\proj\node_modules\..."). Só esses: um IDE aberto na pasta também a cita e também
// escuta numa porta, e o botão de encerrar o fecharia à força. O que vem depois do nome evita que
// "C:\proj" pegue "C:\projeto".
const SERVER_RUNTIME = /^(node|bun|deno|python[\d.]*|pythonw|py|ruby|php|dotnet|java)\.exe$/i
// A raiz de um disco ("C:\") ou de um compartilhamento de rede está em toda linha de comando
// daquele disco: não diz de que projeto o processo é.
const DRIVE_ROOT = /^([a-z]:|\\\\[^\\]+(\\[^\\]+)?)$/

export function mentions(command: string, root: string): boolean {
  const cmd = command.replace(/\//g, '\\').toLowerCase()
  const dir = root.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
  if (!dir || DRIVE_ROOT.test(dir)) return false
  for (let i = cmd.indexOf(dir); i !== -1; i = cmd.indexOf(dir, i + 1)) {
    if (/^($|[\\"' ])/.test(cmd.slice(i + dir.length, i + dir.length + 1))) return true
  }
  return false
}

// `startedPid`: o processo que o play desta pasta abriu (no Windows, o servidor é ele ou um filho).
function belongs(roots: string[], startedPid: number | undefined, p: Listening): boolean {
  if (!IS_WIN) return roots.some((root) => inside(root, p.cwd))
  if (startedPid && (p.pid === startedPid || p.chain?.includes(startedPid))) return true
  return SERVER_RUNTIME.test(p.name ?? '') && roots.some((root) => mentions(p.command, root))
}

// Processos com porta aberta dentro da pasta. Fora o Claude Code e o grupo dele: as portas
// deles não são o servidor do projeto.
export const ofProject = (roots: string[], startedPid: number | undefined, listening: Listening[]): Listening[] =>
  listening.filter((p) => !p.claude && p.ports.length > 0 && belongs(roots, startedPid, p))
