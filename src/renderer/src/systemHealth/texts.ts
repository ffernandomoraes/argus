import type { DiskLevel, MemoryLevel, SystemHealthState } from '../../../shared/systemHealth'
import { LOCALE, tr } from '../i18n'

// Os textos do aviso de memória e disco: o dado e o que ele afeta, sem justificativa.

// O título do aviso e a dica do ícone: o mais grave primeiro.
export function headline(s: SystemHealthState): string {
  if (s.memory?.level === 'tight') return tr('Pouca memória disponível', 'Low on memory')
  if (s.disk?.level === 'full') return tr('Disco cheio', 'Disk full')
  if (s.events.some((e) => e.kind === 'diskFull')) return tr('Disco cheio: algo não foi salvo', "Disk full: something wasn't saved")
  if (s.events.length) return tr('Algo parou por falta de memória', 'Something stopped for lack of memory')
  if (s.memory?.level === 'low') return tr('Memória acabando', 'Memory running low')
  return tr('Disco quase cheio', 'Disk almost full')
}

export function memoryText(level: MemoryLevel): string {
  switch (level) {
    case 'ok':
      return tr('Com folga.', 'Plenty available.')
    case 'low':
      return tr(
        'Está acabando. Se apertar mais, o Argus fecha as conversas paradas fora da tela, e o sistema pode encerrar o que estiver rodando.',
        'Running low. If it gets tighter, Argus closes idle chats that are off screen, and the system may stop whatever is running.'
      )
    case 'tight':
      return tr(
        'Apertada. O Argus fecha as conversas paradas fora da tela para liberar espaço, e o sistema pode encerrar o que estiver rodando, até o Claude no meio de uma resposta.',
        'Tight. Argus closes idle chats that are off screen to free up space, and the system may stop whatever is running, even Claude in the middle of a reply.'
      )
  }
}

export function diskText(level: DiskLevel): string {
  switch (level) {
    case 'ok':
      return tr('Com folga.', 'Plenty available.')
    case 'low':
      return tr('Quase cheio. Cheio, o Argus e o Claude não conseguem salvar.', "Almost full. When it's full, Argus and Claude can't save.")
    case 'full':
      return tr('Cheio. O Argus e o Claude podem não conseguir salvar o que você fizer.', "Full. Argus and Claude may not be able to save what you do.")
  }
}

// "4,2 GB". base: 1024 na memória; no disco, a do sistema (o Finder conta de 1000 em 1000, o Windows de 1024).
export function formatGb(bytes: number, base: number): string {
  const gb = bytes / base ** 3
  return `${gb.toLocaleString(LOCALE, { maximumFractionDigits: gb < 10 ? 1 : 0 })} GB`
}

// "740 MB", "2,1 GB": o tamanho de pastas e do que a limpeza liberou, na base do disco (ver formatGb).
export function formatBytes(bytes: number, base: number): string {
  const mb = bytes / base ** 2
  return mb < 1000 ? `${Math.round(mb).toLocaleString(LOCALE)} MB` : formatGb(bytes, base)
}
