import { basename } from 'node:path'
import type { MenuItemConstructorOptions, NativeImage } from 'electron'
import { titleOf, type ChatEntry } from '../chats/entries'
import { kindOf, LABEL, PRIORITY, type Finished, type Kind } from './kinds'

// Uma linha do menu: a conversa e o estado dela.
export type TrayRow = { cwd: string; sessionId?: string; kind: Kind }

export type MenuOptions = {
  mac: boolean
  // Título no topo, para saber de qual Argus é o menu: o instalado ou o do pnpm dev.
  header: string
  appName: string
  icon: (kind: Kind) => NativeImage
  showApp: () => void
}

const MAX_TITLE = 48

function shorten(text: string): string {
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1) + '…' : text
}

// As conversas abertas e as que terminaram com você fora do app, que continuam aqui mesmo depois
// que a sessão é encerrada (conversa fechada na tela).
export function trayRows(entries: ChatEntry[], finished: Map<string, Finished>): TrayRow[] {
  const live = new Set(entries.map((e) => e.id))
  return [
    ...entries.map((e) => ({ cwd: e.cwd, sessionId: e.state.sessionId, kind: kindOf(e.state, finished.get(e.id)) })),
    ...[...finished].filter(([id]) => !live.has(id)).map(([, f]) => ({ ...f }))
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
        label: `${shorten(titleOf(titles, r.sessionId))}  -  ${LABEL[r.kind]}`,
        // No Windows o menu tem fundo próprio, que não combina com a cor do ícone da barra.
        icon: o.mac ? o.icon(r.kind) : undefined,
        click: o.showApp
      })
    }
  }
  if (!items.length) items.push({ type: 'separator' }, { label: 'Nenhuma conversa aberta', enabled: false })
  // Cabeçalho de menu só existe no macOS; no Windows é uma linha apagada.
  items.unshift(o.mac ? { type: 'header', label: o.header } : { label: o.header, enabled: false })
  items.push(
    { type: 'separator' },
    { label: `Abrir ${o.appName}`, click: o.showApp },
    { label: `Sair do ${o.appName}`, role: 'quit' }
  )
  return items
}
