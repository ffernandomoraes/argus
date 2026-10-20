import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { sameConversation } from './conversationIdentity'
import { TerminalView } from './TerminalView'

// Parte da altura do drawer que o terminal ocupa: abre com 20%, e a divisória não deixa nenhum dos
// dois sumir.
const DEFAULT_RATIO = 0.2
const MIN_RATIO = 0.15
const MAX_RATIO = 0.85

const newKey = () => `drawer-shell-${crypto.randomUUID()}`

// Shell do sistema embaixo da conversa do drawer, para a pessoa rodar os próprios comandos (ssh,
// algo que lê o .env) sem sair dela. O Claude pode digitar nele (sem Enter), mas não vê a saída. O processo é da conversa à vista:
// esconder o painel não o encerra (o ssh continua); trocar de conversa ou fechar o drawer, sim.
export function useDrawerShell(conversation: { id: string; sessionId?: string }) {
  const [shell, setShell] = useState(() => ({ key: newKey(), open: false }))
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  // A chave de agora, para encerrar o processo dela fora do render.
  const live = useRef(shell.key)

  const { id, sessionId } = conversation
  const shown = useRef({ id, sessionId })
  useLayoutEffect(() => {
    const before = shown.current
    shown.current = { id, sessionId }
    if (sameConversation(before, shown.current)) return
    window.api.terminal.kill(live.current)
    live.current = newKey()
    setShell({ key: live.current, open: false })
  }, [id, sessionId])
  useEffect(() => () => window.api.terminal.kill(live.current), [])

  // À vista, a conversa de cima pode digitar nele (a ferramenta digitar_no_terminal).
  const { key, open } = shell
  useEffect(() => {
    if (!open) return
    window.api.terminal.link(key, sessionId ? [id, sessionId] : [id])
    return () => window.api.terminal.unlink(key)
  }, [key, open, id, sessionId])

  // A conversa quer digitar no terminal fechado: abre.
  useEffect(
    () =>
      window.api.terminal.onOpenFor((conversations) => {
        if (conversations.includes(id) || (sessionId && conversations.includes(sessionId))) setShell((s) => (s.open ? s : { ...s, open: true }))
      }),
    [id, sessionId]
  )

  const toggle = useCallback(() => setShell((s) => ({ ...s, open: !s.open })), [])
  return { ...shell, toggle, ratio, setRatio }
}

type Props = {
  sessionKey: string
  cwd: string
  account?: string
  fontScale: number
  ratio: number
  onRatioChange: (ratio: number) => void
  // Área dividida entre a conversa e o terminal: a divisória mede a altura por ela.
  areaRef: RefObject<HTMLElement | null>
}

// O terminal com a divisória em cima, que arrasta para mudar a altura dele.
export function DrawerTerminal({ sessionKey, cwd, account, fontScale, ratio, onRatioChange, areaRef }: Props) {
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current?.getBoundingClientRect()
    if (!area || e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => {
      const next = (area.bottom - ev.clientY) / area.height
      onRatioChange(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)))
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  return (
    <div className="relative flex min-h-0 flex-none flex-col border-t border-line" style={{ height: `${ratio * 100}%` }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize hover:bg-line-strong/60"
      />
      <TerminalView sessionKey={sessionKey} cwd={cwd} account={account} shell fontScale={fontScale} />
    </div>
  )
}
