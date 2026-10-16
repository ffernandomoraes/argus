import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { getConversationSettings } from '../conversationSettings'
import { orchestratorPrompt } from '../../../../shared/orchestrator'
import { getPreferences } from '../../settings/preferences'
import { launchSettings } from '../SessionSettings'
import { connectPty } from './connectPty'
import { createXterm, type Xterm } from './createXterm'
import { fontSizeFor } from './theme'

export type XtermOptions = {
  sessionKey: string
  cwd: string
  // Workspace: as outras pastas dele. Só vale ao abrir, como a conta.
  folders?: string[]
  shell?: boolean
  // Conta do Claude do grupo; vazia = a padrão. Como modelo e esforço, só entra ao abrir.
  account?: string
  // Conversa que o `claude` retoma. Só vale ao abrir: amarrar a conversa criada aqui depois
  // (TerminalNode) não reabre o terminal; reabrir mandava o processo principal fechar o chat dela.
  sessionId?: string
  fontScale: number
  // Pega o foco ao abrir. Vale na abertura, como a conta: mudar depois não mexe no foco.
  autoFocus: boolean
  // Desenha pela placa de vídeo (ver createXterm). Vale na abertura: o modo foco já recria o terminal.
  gpu?: boolean
  // Mudou: abre de novo, lendo conta e conversa outra vez (a troca de conta já encerrou o processo).
  relaunch?: number
}

type Ended = { generation: string; error: string | null; exitCode: number | null }

// Terminal do xterm em `ref`, ligado ao processo da sessão. Abre de novo quando muda a sessão, a
// pasta ou o tipo (claude ou shell), ou com `reopen`; a escala da fonte só ajusta o que está aberto.
export function useXterm(
  ref: RefObject<HTMLElement | null>,
  { sessionKey, cwd, folders, shell, account, sessionId, fontScale, autoFocus, gpu, relaunch = 0 }: XtermOptions
): { error: string | null; exitCode: number | null; reopen: () => void } {
  const [attempt, setAttempt] = useState(0)
  // Erro ou fim do processo da abertura atual; o de uma abertura anterior não vale mais.
  const [ended, setEnded] = useState<Ended | null>(null)
  const generation = `${sessionKey}\n${cwd}\n${shell ? 'shell' : 'claude'}\n${attempt}\n${relaunch}`
  const live = useRef<{ xterm: Xterm; scale: number } | null>(null)

  // Conta, sessão, modelo, esforço e modo valem ao abrir, como no terminal comum (os da conversa
  // que ele retoma): lidos aqui, mudar depois não recria o terminal.
  const open = useEffectEvent((el: HTMLElement, generation: string) => {
    const xterm = createXterm(el, fontSizeFor(fontScale), autoFocus, gpu)
    const settings = getConversationSettings(sessionId)
    const disconnect = connectPty(
      xterm.term,
      {
        key: sessionKey,
        cwd,
        folders,
        shell,
        account,
        sessionId,
        model: settings.model || undefined,
        effort: settings.effort || undefined,
        settingsJson: launchSettings(settings),
        permissionMode: settings.permissionMode || undefined,
        systemPrompt: settings.orchestrator && getPreferences().orchestratorEnabled ? orchestratorPrompt(getPreferences().orchestrator) : undefined
      },
      {
        onError: (error) => setEnded({ generation, error, exitCode: null }),
        onExit: (exitCode) => setEnded({ generation, error: null, exitCode })
      }
    )
    live.current = { xterm, scale: fontScale }
    return () => {
      live.current = null
      disconnect()
      xterm.dispose()
    }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return open(el, generation)
  }, [ref, generation])

  // A montagem já abriu com a escala atual: só uma troca de verdade mexe na fonte.
  useEffect(() => {
    const current = live.current
    if (!current || current.scale === fontScale) return
    current.scale = fontScale
    current.xterm.setFontSize(fontSizeFor(fontScale))
  }, [fontScale])

  const reopen = useCallback(() => setAttempt((a) => a + 1), [])
  const shown = ended?.generation === generation ? ended : null
  return { error: shown?.error ?? null, exitCode: shown?.exitCode ?? null, reopen }
}
