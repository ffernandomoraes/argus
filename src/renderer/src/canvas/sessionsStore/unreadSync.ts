import type { UnreadChat } from '../../../../shared/chat'
import { untildify } from '../../platform'
import { store } from './state'
import { unread } from './unread'

// Manda ao processo principal as conversas com resposta não vista (bolinha verde), com a pasta e o
// título: o ícone da barra de menus conta e lista. Só quando a lista muda de verdade.
let sent = ''

function sync(): void {
  const ids = unread.get()
  const list: UnreadChat[] = []
  if (ids.size) {
    for (const [path, conversations] of store.get().sessions) {
      for (const c of conversations) if (ids.has(c.id)) list.push({ id: c.id, cwd: untildify(path), title: c.title })
    }
  }
  const key = JSON.stringify(list)
  if (key === sent) return
  sent = key
  window.api.chat.setUnread(list)
}

unread.subscribe(sync)
store.subscribe(sync)
