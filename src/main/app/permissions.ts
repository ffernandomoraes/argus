import { session } from 'electron'
import { isAppUrl } from './appUrl'

// Permissões do navegador: só o que o app usa, e só para o quadro principal do app. O resto (e
// tudo da página do protótipo, que é um iframe em localhost) é negado.
// - media (só áudio): o ditado do Windows grava pela janela (preload/winMic/);
// - clipboard-sanitized-write: os botões de copiar (navigator.clipboard.writeText);
// - fullscreen: tela cheia pedida pela página.
// Ninguém lê a área de transferência pela página (colar chega pelo evento de colar), então
// clipboard-read fica negado.
const ALLOWED = new Set(['media', 'clipboard-sanitized-write', 'fullscreen'])

type PermissionAsk = {
  permission: string
  isMainFrame: boolean
  requestingUrl?: string
  // Para 'media': o que foi pedido (pedido de verdade) ou conferido (consulta).
  mediaTypes?: readonly string[]
}

// Decisão sem Electron, para dar para testar.
export function permissionAllowed(ask: PermissionAsk, isApp: (url: string | undefined) => boolean): boolean {
  if (!ALLOWED.has(ask.permission) || !ask.isMainFrame || !isApp(ask.requestingUrl)) return false
  if (ask.permission !== 'media') return true
  // Microfone sim, câmera não.
  return !!ask.mediaTypes?.length && ask.mediaTypes.every((t) => t === 'audio')
}

export function setupPermissions(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    callback(permissionAllowed({ permission, isMainFrame: details.isMainFrame, requestingUrl: details.requestingUrl, mediaTypes }, isAppUrl))
  })
  ses.setPermissionCheckHandler((_wc, permission, _origin, details) => {
    const mediaTypes = details.mediaType ? [details.mediaType] : undefined
    return permissionAllowed({ permission, isMainFrame: details.isMainFrame, requestingUrl: details.requestingUrl, mediaTypes }, isAppUrl)
  })
}
