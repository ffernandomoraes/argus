import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { IS_WIN } from '../platform'

const THEME = {
  background: '#0c0c0d',
  foreground: '#e7e7ea',
  cursor: '#e7e7ea',
  selectionBackground: '#3a3a42',
  // O xterm 6 desenha a própria barra de rolagem; cores iguais às do resto do app.
  scrollbarSliderBackground: 'rgba(124, 124, 135, 0.35)',
  scrollbarSliderHoverBackground: 'rgba(124, 124, 135, 0.6)',
  scrollbarSliderActiveBackground: 'rgba(168, 168, 178, 0.7)'
}

const FONT_SIZE = 12

// Terminal de verdade rodando o `claude` (ou o shell, com `shell`) na pasta. O processo vive
// no processo principal: fechar o painel ou trocar de conversa não encerra a sessão.
export function TerminalView({
  sessionKey,
  cwd,
  account,
  shell,
  sessionId,
  model,
  effort,
  settingsJson,
  permissionMode,
  fontScale = 1
}: {
  sessionKey: string
  cwd: string
  // Conta do Claude do grupo; vazia = a padrão. Como modelo e esforço, só entra ao abrir.
  account?: string
  shell?: boolean
  sessionId?: string
  model?: string
  effort?: string
  settingsJson?: string
  permissionMode?: string
  // Escala do drawer: o xterm desenha o próprio texto, então ela vira tamanho de fonte.
  fontScale?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const live = useRef<{ term: Terminal; fit: FitAddon } | null>(null)
  // Mudar a escala ajusta o terminal aberto; não recria a sessão.
  const scale = useRef(fontScale)
  scale.current = fontScale
  // Modelo e esforço só entram ao abrir; mudar depois não recria o terminal.
  const launch = useRef({ account, model, effort, settingsJson, permissionMode })
  launch.current = { account, model, effort, settingsJson, permissionMode }
  const [error, setError] = useState<string | null>(null)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setError(null)
    setExitCode(null)

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, 'Cascadia Mono', Consolas, monospace",
      fontSize: Math.round(FONT_SIZE * scale.current),
      lineHeight: 1.2,
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 5000,
      theme: THEME
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    // Windows: Ctrl+C copia quando há texto selecionado (sem seleção, interrompe, como sempre) e
    // Ctrl+V cola, como no Terminal do Windows e no VS Code. No Mac, ⌘C e ⌘V passam pelo menu Editar.
    if (IS_WIN) {
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true
        const key = e.key.toLowerCase()
        if (key === 'c' && (e.shiftKey || term.hasSelection())) {
          e.preventDefault()
          void navigator.clipboard.writeText(term.getSelection())
          term.clearSelection()
          return false
        }
        // O xterm não trata a tecla: o navegador cola, e o texto chega pelo evento de colar.
        return key !== 'v'
      })
    }
    fit.fit()
    term.focus()
    live.current = { term, fit }

    let disposed = false
    const api = window.api.terminal
    const offData = api.onData((key, data) => key === sessionKey && term.write(data))
    const offExit = api.onExit((key, code) => key === sessionKey && setExitCode(code))
    const input = term.onData((data) => api.write(sessionKey, data))

    api
      .open({
        key: sessionKey,
        cwd,
        account: launch.current.account,
        shell,
        sessionId,
        model: launch.current.model || undefined,
        effort: launch.current.effort || undefined,
        settingsJson: launch.current.settingsJson,
        permissionMode: launch.current.permissionMode || undefined,
        cols: term.cols,
        rows: term.rows
      }).then((res) => {
      if (disposed) return
      if (!res.ok) setError(res.error)
      else if (res.buffer) term.write(res.buffer)
    })

    const resize = new ResizeObserver(() => {
      fit.fit()
      api.resize(sessionKey, term.cols, term.rows)
    })
    resize.observe(el)

    return () => {
      disposed = true
      live.current = null
      resize.disconnect()
      input.dispose()
      offData()
      offExit()
      term.dispose()
    }
  }, [sessionKey, cwd, shell, sessionId, attempt])

  useEffect(() => {
    const open = live.current
    if (!open) return
    open.term.options.fontSize = Math.round(FONT_SIZE * fontScale)
    open.fit.fit()
    window.api.terminal.resize(sessionKey, open.term.cols, open.term.rows)
  }, [fontScale, sessionKey])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ background: THEME.background }}>
      <div ref={ref} className="min-h-0 flex-1 px-3 py-2" />
      {(error || exitCode !== null) && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5 text-xs">
          <span className="text-muted">{error ?? `Sessão encerrada (código ${exitCode}).`}</span>
          {!error && (
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="rounded-md border border-line px-2 py-1 text-text hover:bg-surface-2"
            >
              Abrir de novo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
