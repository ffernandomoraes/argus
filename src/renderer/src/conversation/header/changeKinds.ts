import type { UncommittedFile } from '../../../../shared/sessions'

// Cor da letra de cada mudança, nos tons do VS Code.
export const KIND_COLOR: Record<UncommittedFile['kind'], string> = {
  M: 'text-needs-you',
  R: 'text-needs-you',
  A: 'text-done',
  U: 'text-done',
  D: 'text-red-400',
  '!': 'text-red-400'
}

export const KIND_LABEL: Record<UncommittedFile['kind'], string> = {
  M: 'Alterado',
  R: 'Renomeado',
  A: 'Adicionado',
  U: 'Novo, fora do git',
  D: 'Apagado',
  '!': 'Em conflito'
}
