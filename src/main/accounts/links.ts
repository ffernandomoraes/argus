import { existsSync, linkSync, lstatSync, mkdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { IS_WIN } from '../platform'
import { MAIN_DIR } from './paths'

// Ligados à principal: o histórico das conversas (com a memória automática, que mora nele), as
// instruções, agentes, skills, comandos, plugins e configurações. O Claude Code grava as
// configurações do usuário através do link; só recusa link nas de projeto, que ficam na pasta do
// projeto e não passam por aqui. O .claude.json nunca é ligado: ele guarda a organização da
// conta, que o Claude Code usa nos pedidos, e misturaria uma conta com a outra.
const SHARED = [
  'projects',
  'CLAUDE.md',
  'settings.json',
  'keybindings.json',
  'agents',
  'skills',
  'commands',
  'plugins',
  'output-styles'
]

// Também enxerga link quebrado, que o existsSync não vê.
function exists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

// No Windows, link simbólico pede administrador (ou o Modo de Desenvolvedor ligado). Pasta vira
// junction, que não pede; arquivo tenta o link simbólico e, sem permissão, vira link físico: o
// mesmo arquivo no disco com dois nomes. O físico se desfaz se um programa trocar o arquivo da
// principal por outro (gravar numa cópia e renomear), e aí cada conta fica com a sua versão.
function linkItem(target: string, path: string): void {
  if (!IS_WIN) return symlinkSync(target, path)
  if (statSync(target).isDirectory()) return symlinkSync(target, path, 'junction')
  try {
    symlinkSync(target, path, 'file')
  } catch {
    linkSync(target, path)
  }
}

// Cria os links que faltam. Roda antes de cada `claude` da conta, então o que surgir depois na
// principal (uma pasta de comandos nova, por exemplo) passa a valer aqui também. O que o Claude
// Code já tiver criado como item de verdade fica como está, para nada se perder.
export function link(dir: string): void {
  mkdirSync(join(dir, 'sessions'), { recursive: true })
  mkdirSync(join(MAIN_DIR, 'projects'), { recursive: true })
  for (const name of SHARED) {
    const target = join(MAIN_DIR, name)
    const path = join(dir, name)
    if (!existsSync(target) || exists(path)) continue
    try {
      linkItem(target, path)
    } catch {
      // o próprio `claude` criou o item no mesmo instante
    }
  }
}

// Tira os links da pasta da conta, um a um: apagar a pasta nunca pode alcançar o que é da
// principal. false se algum não saiu (aí a pasta fica; o link físico do Windows sai junto com
// ela sem tocar no original).
export function unlinkShared(dir: string): boolean {
  for (const name of SHARED) {
    const path = join(dir, name)
    try {
      if (isLink(path)) unlinkSync(path)
    } catch {
      // segue para a conferência abaixo
    }
    if (isLink(path)) {
      console.warn('[accounts] link não saiu; a pasta da conta fica:', path)
      return false
    }
  }
  return true
}
