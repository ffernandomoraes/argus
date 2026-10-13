import type { UncommittedFile } from '../../../../shared/sessions'
import { tr } from '../../i18n'

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
  M: tr('Alterado', 'Modified'),
  R: tr('Renomeado', 'Renamed'),
  A: tr('Adicionado', 'Added'),
  U: tr('Novo, fora do git', 'New, untracked'),
  D: tr('Apagado', 'Deleted'),
  '!': tr('Em conflito', 'Conflicted')
}
