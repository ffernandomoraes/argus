import type { XYPosition } from '@xyflow/react'
import type { AreaNode, ChatNode, ChatPanelNode, NoteNode, ProjectData, ProjectNode, TerminalKind, TerminalNode } from './types'
import { baseName, tildify } from '../platform'

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

// "~/Desktop/proj" (no Windows, "~\Desktop\proj"): é assim que o canvas guarda as pastas.
export function displayPath(path: string): string {
  return tildify(path)
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
    data: { name: baseName(path), path, kind }
  }
}

export function createFolderInstance(position: XYPosition, folder: string): ProjectNode {
  return {
    id: `p-${crypto.randomUUID()}`,
    type: 'project',
    position,
    data: {
      name: baseName(folder),
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

// Conversa no canvas: perto da largura do painel lateral, e alta o bastante para ler a resposta.
export const CHAT_PANEL_SIZE = { width: 600, height: 680 }

// A posição é decidida por placeBeside, ao lado de quem abriu a conversa.
export function createChatPanel(project: ProjectData, loose: boolean, conversation: { id: string; title: string }): ChatPanelNode {
  return {
    id: `cp-${crypto.randomUUID()}`,
    type: 'chatPanel',
    position: { x: 0, y: 0 },
    style: { ...CHAT_PANEL_SIZE },
    dragHandle: '.chat-panel-drag',
    data: {
      name: conversation.title,
      path: project.path,
      ...(!loose && { projectName: project.name }),
      sessionId: conversation.id
    }
  }
}

// Amarelo de post-it: se destaca das pastas e dos grupos, que nascem cinza.
export const DEFAULT_NOTE_COLOR = '#f59e0b'
// Sem tamanho no nó: o React Flow mede o balão, que acompanha o texto.
export const NOTE_MAX_WIDTH = 280
export const NOTE_MIN_WIDTH = 120
// Tamanho do balão vazio, antes de o React Flow medir (para achar um lugar livre).
export const NOTE_SIZE = { width: 160, height: 38 }

export function createNote(position: XYPosition): NoteNode {
  return {
    id: `n-${crypto.randomUUID()}`,
    type: 'note',
    position,
    data: { text: '', color: DEFAULT_NOTE_COLOR }
  }
}
