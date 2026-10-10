import type { WebContents } from 'electron'
import type { DesignCommentAction } from '../../shared/ipc'
import { COMMENT } from './scripts/comment'
import { escapeScript } from './scripts/escape'
import { STATE } from './scripts/state'
import { TRACK } from './scripts/track'

// Scripts do modo design na página do protótipo (o iframe do drawer): Esc, endereço, comentários
// e o retrato em texto. Cada script fica em scripts/.

// Só o servidor local do projeto: os scripts do modo design não entram em nenhuma outra página.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export function escapeInPage(wc: WebContents, origin: string, on: boolean): void {
  inPage(wc, origin, escapeScript(on))
}

export function trackInPage(wc: WebContents, origin: string): void {
  inPage(wc, origin, TRACK)
}

export function commentInPage(wc: WebContents, origin: string, action: DesignCommentAction, id?: number): void {
  const call =
    action === 'on' || action === 'off'
      ? `window.__argusComment.on(${action === 'on'})`
      : action === 'remove'
        ? `window.__argusComment.remove(${Number(id) || 0})`
        : 'window.__argusComment.clear()'
  inPage(wc, origin, `${COMMENT}; ${call}`)
}

// O retrato da página do protótipo (a do drawer, não um iframe dentro dela); nulo se não deu a tempo.
export async function snapshotPage(wc: WebContents, origin: string): Promise<string | null> {
  if (!LOCAL.test(origin)) return null
  const frame = wc.mainFrame.framesInSubtree.find((f) => {
    if (f.parent !== wc.mainFrame) return false
    try {
      return new URL(f.url).origin === origin
    } catch {
      return false
    }
  })
  if (!frame) return null
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
  const result = frame.executeJavaScript(STATE).then(
    (r: unknown) => (typeof r === 'string' && r ? r : null),
    () => null
  )
  return Promise.race([result, timeout])
}

function inPage(wc: WebContents, origin: string, script: string): void {
  if (!LOCAL.test(origin)) return
  for (const frame of wc.mainFrame.framesInSubtree) {
    if (frame === wc.mainFrame) continue
    let frameOrigin = ''
    try {
      frameOrigin = new URL(frame.url).origin
    } catch {
      continue
    }
    if (frameOrigin === origin) void frame.executeJavaScript(script).catch(() => {})
  }
}
