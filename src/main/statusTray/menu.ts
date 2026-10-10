import { basename } from 'node:path'
import type { MenuItemConstructorOptions, NativeImage } from 'electron'
import type { UnreadChat } from '../../shared/chat'
import { titleOf, type ChatEntry } from '../chats/entries'
import { kindOf, LABEL, PRIORITY, summary, type Finished, type Kind } from './kinds'

// Uma linha do menu: a conversa e o estado dela. `title`: já conhecido (as não vistas trazem o da
// janela); sem ele, lido do arquivo da sessão.
export type TrayRow = { cwd: string; sessionId?: string; title?: string; kind: Kind }

export type MenuOptions = {
  mac: boolean
  // Título no topo, para saber de qual Argus é o menu: o instalado ou o do pnpm dev.
  header: string
  appName: string
  icon: (kind: Kind) => NativeImage
  showApp: () => void
  // Traz o app e abre a conversa.
  openChat: (cwd: string, sessionId: string) => void
}

const MAX_TITLE = 48

function shorten(text: string): string {
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1) + '…' : text
}

// As conversas abertas, as que pararam com erro com você fora do app e as com resposta não vista,
// que continuam aqui mesmo depois que a sessão é encerrada (conversa fechada na tela).
export function trayRows(entries: ChatEntry[], finished: Map<string, Finished>, unread: UnreadChat[]): TrayRow[] {
  const unreadIds = new Set(unread.map((u) => u.id))
  const live = new Set(entries.map((e) => e.id))
  const errors = [...finished].filter(([id]) => !live.has(id)).map(([, f]) => f)
  // Conversas que já têm linha: a não vista delas não entra de novo.
  const listed = new Set([...entries.map((e) => e.state.sessionId), ...errors.map((f) => f.sessionId)])
  return [
    ...entries.map((e) => ({
      cwd: e.cwd,
      sessionId: e.state.sessionId,
      kind: kindOf(e.state, finished.get(e.id), !!e.state.sessionId && unreadIds.has(e.state.sessionId))
    })),
    ...errors.map((f) => ({ ...f })),
    ...unread.filter((u) => !listed.has(u.id)).map((u) => ({ cwd: u.cwd, sessionId: u.id, title: u.title, kind: 'done' as const }))
  ]
}

// Menu do ícone: as conversas agrupadas por pasta, a mais urgente primeiro em cada uma.
export function trayMenu(rows: TrayRow[], titles: Map<string, string>, o: MenuOptions): MenuItemConstructorOptions[] {
  const byProject = new Map<string, TrayRow[]>()
  for (const r of rows) byProject.set(r.cwd, [...(byProject.get(r.cwd) ?? []), r])

  const items: MenuItemConstructorOptions[] = []
  for (const [cwd, list] of byProject) {
    items.push({ type: 'separator' })
    items.push({ label: basename(cwd) || cwd, enabled: false })
    for (const r of list.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))) {
      items.push({
        label: `${shorten(r.title ?? titleOf(titles, r.sessionId))}  -  ${LABEL[r.kind]}`,
        // No Windows o menu tem fundo próprio, que não combina com a cor do ícone da barra.
        icon: o.mac ? o.icon(r.kind) : undefined,
        click: () => (r.sessionId ? o.openChat(r.cwd, r.sessionId) : o.showApp())
      })
    }
  }
  if (!items.length) items.push({ type: 'separator' }, { label: 'Nenhuma conversa aberta', enabled: false })
  // Logo abaixo do título, o resumo: quantas rodando, esperando você, concluídas.
  const counts = summary(rows.map((r) => r.kind))
  if (counts) items.unshift({ label: counts.charAt(0).toUpperCase() + counts.slice(1), enabled: false })
  // Cabeçalho de menu só existe no macOS; no Windows é uma linha apagada.
  items.unshift(o.mac ? { type: 'header', label: o.header } : { label: o.header, enabled: false })
  items.push(
    { type: 'separator' },
    { label: `Abrir ${o.appName}`, click: o.showApp },
    { label: `Sair do ${o.appName}`, role: 'quit' }
  )
  return items
}
