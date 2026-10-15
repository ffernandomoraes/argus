import type { XYPosition } from '@xyflow/react'
import type { AreaNode, ChatNode, ChatPanelNode, NoteNode, ProjectData, ProjectNode, TerminalKind, TerminalNode, WorktreeLink } from './types'
import { baseName, tildify } from '../platform'
import { tr } from '../i18n'

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

// Grupo novo, e o tamanho de volta de um grupo recolhido que não guardou o dele.
export const GROUP_SIZE = { width: 480, height: 320 }

export function createGroup(position: XYPosition): AreaNode {
  return {
    id: `g-${crypto.randomUUID()}`,
    type: 'area',
    position,
    style: { ...GROUP_SIZE },
    data: { label: tr('Novo grupo', 'New group'), color: DEFAULT_GROUP_COLOR }
  }
}

// Instância = uma pasta de projeto. Largura fixa; a altura acompanha as conversas.
export const INSTANCE_WIDTH = 400
export const INSTANCE_MIN_HEIGHT = 130

// O que a pasta desenha fora da própria caixa: os botões flutuantes, acima (24px de botão
// + 6px de respiro). O grupo precisa contar com isso ao crescer ou se ajustar, senão corta
// os botões. As linhas até as conversas ficam dentro da caixa, no recuo da pilha.
export const PROJECT_OUTSET = { left: 0, top: 30 }

// O grupo desenha o nome e os botões em cima da borda: metade (12px) fica acima dela.
export const AREA_OUTSET = { left: 0, top: 12 }

// "~/Desktop/proj" (no Windows, "~\Desktop\proj"): é assim que o canvas guarda as pastas.
export function displayPath(path: string): string {
  return tildify(path)
}

// Tamanho que dá para trabalhar sem ocupar o canvas inteiro.
export const TERMINAL_SIZE = { width: 620, height: 380 }

// folders e name: aberto num workspace, as pastas dele e o nome (a pasta dele é só um id).
export function createTerminal(
  position: XYPosition,
  folder: string,
  kind: TerminalKind = 'claude',
  account?: string,
  folders?: string[],
  name?: string
): TerminalNode {
  const path = displayPath(folder)
  return {
    id: `t-${crypto.randomUUID()}`,
    type: 'terminal',
    position,
    style: { ...TERMINAL_SIZE },
    data: { name: name ?? baseName(path), path, kind, ...(account && { account }), ...(folders?.length && { folders }) }
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

// Tarefa isolada (git worktree): card filho da pasta, com o nome da tarefa. A posição é decidida
// por placeBelow, embaixo da pasta.
export function createWorktreeNode(folder: string, name: string, link: WorktreeLink): ProjectNode {
  return {
    id: `p-${crypto.randomUUID()}`,
    type: 'project',
    position: { x: 0, y: 0 },
    data: { name, path: displayPath(folder), color: '#71717a', worktree: link }
  }
}

// Workspace: várias pastas num card só, todas iguais. `dir`: a pasta dele (nos dados do Argus, ou no
// Linux do WSL quando as pastas são todas de lá), onde as conversas abrem (ver ProjectData.folders e src/main/workspaces.ts).
export function createWorkspace(position: XYPosition, folders: string[], dir: string): ProjectNode {
  return {
    id: `p-${crypto.randomUUID()}`,
    type: 'project',
    position,
    data: { name: tr('Espaço de trabalho', 'Workspace'), path: displayPath(dir), color: '#71717a', folders: folders.map(displayPath) }
  }
}

// Card da conversa solta: da largura de uma conversa na pilha da pasta.
export const CHAT_SIZE = { width: 320, height: 34 }

// Conversa sem projeto roda na pasta do usuário. Para o painel, ela se apresenta como uma
// pasta sem nome de projeto.
export function looseProject(): ProjectData {
  return { name: tr('Sem projeto', 'No project'), path: displayPath(window.api.homeDir), color: '#71717a' }
}

export function createChat(position: XYPosition, sessionId: string): ChatNode {
  return {
    id: `c-${crypto.randomUUID()}`,
    type: 'chat',
    position,
    data: { name: tr('Conversa', 'Chat'), path: looseProject().path, sessionId }
  }
}

// Conversa no canvas: perto da largura do painel lateral, e alta o bastante para ler a resposta.
const CHAT_PANEL_SIZE = { width: 600, height: 680 }

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
      ...(project.folders && { folders: project.folders }),
      sessionId: conversation.id
    }
  }
}

// Amarelo de post-it: se destaca das pastas e dos grupos, que nascem cinza.
const DEFAULT_NOTE_COLOR = '#f59e0b'
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
