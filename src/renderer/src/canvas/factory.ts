import type { XYPosition } from '@xyflow/react'
import type { AreaNode, ChatNode, ProjectData, ProjectNode, TerminalKind, TerminalNode } from './types'

export const COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#71717a'
]

// Cinza: o último da paleta.
export const DEFAULT_GROUP_COLOR = '#71717a'

export function createGroup(position: XYPosition): AreaNode {
  return {
    id: `g-${crypto.randomUUID()}`,
    type: 'area',
    position,
    style: { width: 480, height: 320 },
    data: { label: 'Novo grupo', color: DEFAULT_GROUP_COLOR }
  }
}

// Instância = uma pasta de projeto. Largura fixa; a altura acompanha as conversas.
export const INSTANCE_WIDTH = 400
export const INSTANCE_MIN_HEIGHT = 130

// O que a pasta desenha fora da própria caixa: os botões flutuantes, acima (24px de botão
// + 6px de respiro). O grupo precisa contar com isso ao crescer ou se ajustar, senão corta
// os botões. As linhas até as conversas ficam dentro da caixa, no recuo da pilha.
export const PROJECT_OUTSET = { left: 0, top: 30 }

// O grupo desenha o nome e a setinha acima da borda (24px + 6px de respiro).
export const AREA_OUTSET = { left: 0, top: 30 }

export function displayPath(path: string): string {
  const home = window.api.homeDir
  return path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

// Tamanho que dá para trabalhar sem ocupar o canvas inteiro.
export const TERMINAL_SIZE = { width: 620, height: 380 }

export function createTerminal(position: XYPosition, folder: string, kind: TerminalKind = 'claude'): TerminalNode {
  const path = displayPath(folder)
  return {
    id: `t-${crypto.randomUUID()}`,
    type: 'terminal',
    position,
    style: { ...TERMINAL_SIZE },
    data: { name: path.split('/').filter(Boolean).pop() ?? path, path, kind }
  }
}

export function createFolderInstance(position: XYPosition, folder: string): ProjectNode {
  return {
    id: `p-${crypto.randomUUID()}`,
    type: 'project',
    position,
    data: {
      name: folder.split('/').filter(Boolean).pop() ?? folder,
      path: displayPath(folder),
      color: '#71717a'
    }
  }
}

// Card da conversa solta: da largura de uma conversa na pilha da pasta.
export const CHAT_SIZE = { width: 320, height: 34 }

// Conversa sem projeto roda na pasta do usuário. Para o painel, ela se apresenta como uma
// pasta sem nome de projeto.
export function looseProject(): ProjectData {
  return { name: 'Sem projeto', path: displayPath(window.api.homeDir), color: '#71717a' }
}

export function createChat(position: XYPosition, sessionId: string): ChatNode {
  return {
    id: `c-${crypto.randomUUID()}`,
    type: 'chat',
    position,
    data: { name: 'Conversa', path: looseProject().path, sessionId }
  }
}
