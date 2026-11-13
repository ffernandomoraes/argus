import { Loader2 } from 'lucide-react'
import { tr } from '../../i18n'
import type { TimelineItem } from './timelineItem'

const OLDER_KEY = 'older-messages'

// Primeiro item da conversa enquanto há mensagens anteriores: o loader, centralizado, aparece nele
// quando elas estão vindo. Sempre da mesma altura, para não empurrar a conversa ao aparecer.
export const olderRow = (loading: boolean): TimelineItem => ({
  kind: 'divider',
  key: OLDER_KEY,
  node: (
    <div className="flex h-6 items-center justify-center text-faint" role="status">
      {loading && <Loader2 size={16} className="animate-spin" aria-label={tr('Carregando mensagens anteriores', 'Loading earlier messages')} />}
    </div>
  )
})
