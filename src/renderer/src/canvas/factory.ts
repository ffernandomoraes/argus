import type { XYPosition } from '@xyflow/react'
import type { AreaNode, ProjectNode, TerminalNode } from './types'

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

function displayPath(path: string): string {
  const home = window.api.homeDir
  return path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

// Tamanho que dá para trabalhar sem ocupar o canvas inteiro.
export const TERMINAL_SIZE = { width: 620, height: 380 }

export function createTerminal(position: XYPosition, folder: string, sessionId?: string, name?: string): TerminalNode {
  const path = displayPath(folder)
  return {
    id: `t-${crypto.randomUUID()}`,
    type: 'terminal',
    position,
    style: { ...TERMINAL_SIZE },
    data: { name: name ?? path.split('/').filter(Boolean).pop() ?? path, path, sessionId }
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
