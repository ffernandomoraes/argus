import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref
} from 'react'
import type { AgentDef } from '../../../../shared/agents'
import { Presence } from '../../motion'
import { keys } from '../../platform'
import { AgentMenu } from '../AgentMenu'
import { AttachmentList } from '../AttachmentList'
import { transcriptsPending } from '../audio/transcripts'
import type { SessionSettings } from '../SessionSettings'
import { SlashMenu } from '../SlashMenu'
import type { SlashCommand } from '../slashCommands'
import type { OutgoingMessage } from '../timeline/useOptimisticSends'
import { useAttachments } from '../useAttachments'
import { useDictation, type DictationState } from '../useDictation'
import { ComposerActions } from './ComposerActions'
import { ComposerFooter } from './ComposerFooter'
import { ComposerNotices } from './ComposerNotices'
import { pastedFiles } from './pastedFiles'
import { useComposerMenus } from './useComposerMenus'
import { useDraft } from './useDraft'
import { usePromptHistory } from './usePromptHistory'
import { tr } from '../../i18n'

export type ComposerHandle = {
  // Envio que não chegou: o texto volta (se o campo estiver vazio), os anexos voltam e o aviso aparece.
  restore: (typed: string, files: File[], error: string) => void
}

type Props = {
  ref?: Ref<ComposerHandle>
  draftKey: string
  // Foco no campo ao aparecer.
  autoFocus: boolean
  agents: AgentDef[]
  // Claude trabalhando: com nada para enviar, o botão vira Parar.
  running: boolean
  // Envia; a promessa falha se o envio não saiu (o texto e os anexos voltam para o campo).
  onSubmit: (message: OutgoingMessage) => Promise<void>
  onOpenMcp: () => void
  onToggleRemote: () => void
  onInterrupt: () => void
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
  contextPercent: number
  compact: boolean
  above?: ReactNode
  chips?: ReactNode
  extraSend?: { compose: (text: string) => string }
  // Pedidos gravados na conversa, do mais velho ao mais novo: as setas percorrem eles.
  pastPrompts?: string[]
}

const NO_PROMPTS: string[] = []

// Caixa de escrever da conversa, com estado próprio: digitar não redesenha a conversa. Texto,
// menus de comandos e de agentes, anexos (botão ou ⌘V), ditado, enviar ou parar, e os seletores
// de modelo e modo embaixo.
export const Composer = memo(function Composer(props: Props) {
  const { ref, draftKey, autoFocus, agents, running, onSubmit, onOpenMcp, onToggleRemote, onInterrupt, extraSend } = props
  const attachments = useAttachments(draftKey)
  const field = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useDraft(draftKey)
  const menus = useComposerMenus(draft, agents)
  const [sendError, setSendError] = useState<string | null>(null)
  const history = usePromptHistory(draftKey, props.pastPrompts ?? NO_PROMPTS)

  // Abrir a conversa já deixa o campo pronto para digitar, com o cursor no fim do rascunho.
  // Espera um quadro: o drawer nasce invisível até ser posicionado, e campo invisível não recebe foco.
  // Sem autoFocus (bloco do canvas que não é novo), o campo espera o clique.
  useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => {
      const el = field.current
      if (!el) return
      focusField(el)
      el.setSelectionRange(el.value.length, el.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])

  // Ditado: o que for falado entra depois do texto que já estava no campo ao começar.
  const dictationBase = useRef('')
  const dictation = useDictation((spoken) => {
    const base = dictationBase.current
    setDraft(base && spoken ? `${base.trimEnd()} ${spoken}` : base + spoken)
  })
  // O texto ditado entra por código, e o navegador não rola o campo sozinho:
  // sem isso as últimas palavras ficam escondidas abaixo da terceira linha.
  useEffect(() => {
    const el = field.current
    if (!el || dictation.state === 'idle') return
    el.setSelectionRange(el.value.length, el.value.length)
    el.scrollTop = el.scrollHeight
  }, [draft, dictation.state])

  const addFiles = attachments.add
  const restore = useCallback(
    (typed: string, files: File[], error: string) => {
      setDraft((current) => current || typed)
      if (files.length) addFiles(files)
      setSendError(error)
    },
    [setDraft, addFiles]
  )
  useImperativeHandle(ref, () => ({ restore }), [restore])

  const canSend = draft.trim().length > 0 || attachments.items.length > 0 || !!extraSend

  const updateDraft = (value: string) => {
    setDraft(value)
    menus.reset()
    setSendError(null)
  }

  // command: comando escolhido no menu, enviado no lugar do que está no campo.
  const send = (command?: string) => {
    if (dictation.state !== 'idle') dictation.stop()
    if (!command && !canSend) return
    const typed = command ?? draft.trim()
    const text = extraSend && !typed.startsWith('/') ? extraSend.compose(typed) : typed
    if (text === '/mcp') {
      setDraft('')
      return onOpenMcp()
    }
    if (text === '/remote-control') {
      setDraft('')
      return onToggleRemote()
    }
    const files = attachments.items.map((a) => a.file)
    // Áudio ainda sem transcrição (ou sem resposta à pergunta de baixar o modelo): espera.
    if (transcriptsPending(files)) {
      setSendError(tr('Espere a transcrição do áudio terminar, ou escolha "Agora não" nele.', 'Wait for the audio transcript to finish, or choose "Not now" on it.'))
      return
    }
    if (typed) history.remember(typed)
    setDraft('')
    setSendError(null)
    attachments.clear()
    onSubmit({ text, typed, files }).catch((err: unknown) => restore(typed, files, sendFailure(err)))
  }

  // Escolher um agente completa o nome dele no campo; escolher um comando já executa ele.
  const selectAgent = (a: AgentDef) => {
    setDraft(`${draft.slice(0, menus.mention?.start ?? draft.length)}@${a.name} `)
    menus.close()
    focusField(field.current)
  }
  const selectCommand = (c: SlashCommand) => {
    menus.close()
    send(`/${c.name}`)
    focusField(field.current)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra a linha (igual à extensão do VS Code).
    if (menus.size === undefined) {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        send()
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        // Setas percorrem os pedidos já enviados (campo vazio ou mostrando um deles), cursor no fim.
        const recalled = history.step(e.key === 'ArrowUp' ? -1 : 1, draft)
        if (recalled === null) return
        e.preventDefault()
        setDraft(recalled)
        setSendError(null)
        // Pedido que começa com / ou @ não abre o menu: as setas continuam no histórico.
        menus.close()
        requestAnimationFrame(() => {
          const el = field.current
          if (el) el.setSelectionRange(el.value.length, el.value.length)
        })
      }
      return
    }
    const command = menus.commands?.[menus.active]
    const agent = menus.mention?.items[menus.active]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      menus.move(e.key === 'ArrowDown' ? 1 : -1)
    } else if ((e.key === 'Enter' || e.key === 'Tab') && command) {
      e.preventDefault()
      selectCommand(command)
    } else if ((e.key === 'Enter' || e.key === 'Tab') && agent) {
      e.preventDefault()
      selectAgent(agent)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      menus.close()
    }
  }

  const toggleDictation = () => {
    if (dictation.state === 'idle') {
      dictationBase.current = draft
      menus.close()
      focusField(field.current)
    }
    dictation.toggle()
  }

  const openCommands = () => {
    updateDraft('/')
    focusField(field.current)
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = pastedFiles(e.clipboardData, (f) => window.api.filePath(f))
    if (!files.length) return
    e.preventDefault()
    attachments.add(files)
  }

  // Arquivo arrastado para a caixa (do Finder, do Explorer, de outro app) vira anexo, como no ⌘V.
  // Sem isto o Chromium tentava abrir o arquivo na janela (bloqueado em lockNavigation) e nada
  // acontecia. Texto arrastado segue o padrão do campo.
  const [dragging, setDragging] = useState(false)
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setDragging(false)
    if (!hasFiles(e) || !e.dataTransfer.files.length) return
    e.preventDefault()
    attachments.add(e.dataTransfer.files)
    focusField(field.current)
  }

  return (
    <>
      {props.above}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-lg border bg-surface focus-within:border-line-strong ${dragging ? 'border-accent' : 'border-line'}`}
      >
        <Presence kind="menu">
          {menus.commands && (
            <SlashMenu items={menus.commands} active={menus.active} onHover={menus.setActive} onSelect={selectCommand} />
          )}
        </Presence>
        <Presence kind="menu">
          {menus.mention && (
            <AgentMenu items={menus.mention.items} active={menus.active} onHover={menus.setActive} onSelect={selectAgent} />
          )}
        </Presence>
        {props.chips}
        <AttachmentList items={attachments.items} onRemove={attachments.remove} />
        {/* Começa com 1 linha e cresce com o texto até 3; daí em diante rola. O placeholder
            não quebra linha: se quebrasse, a caixa vazia já nasceria alta. */}
        <textarea
          ref={field}
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => menus.close()}
          onPaste={onPaste}
          rows={1}
          placeholder={placeholderFor(dictation.state, agents.length > 0)}
          className="mb-1.5 block max-h-[calc(3lh+1rem)] min-h-[calc(1lh+1rem)] w-full resize-none bg-transparent px-3 py-2 text-sm outline-none [field-sizing:content] placeholder:overflow-hidden placeholder:whitespace-nowrap placeholder:text-faint"
        />
        <ComposerActions
          onOpenCommands={openCommands}
          onFiles={attachments.add}
          dictation={dictation.state}
          onToggleDictation={toggleDictation}
          stopping={running && !canSend}
          onStop={onInterrupt}
          onSend={() => send()}
          sendDisabled={!canSend && dictation.state === 'idle'}
        />
      </div>
      <ComposerNotices sendError={sendError} error={dictation.error} />
      <ComposerFooter
        settings={props.settings}
        onSettingChange={props.onSettingChange}
        contextPercent={props.contextPercent}
        compact={props.compact}
      />
    </>
  )
})

// Foco sem rolar o que está em volta: com a conversa num bloco do canvas, focar o campo deslocava
// o canvas.
function focusField(el: HTMLTextAreaElement | null): void {
  el?.focus({ preventScroll: true })
}

function placeholderFor(dictation: DictationState, withAgents: boolean): string {
  if (dictation === 'listening') return tr('Ouvindo… fale à vontade', 'Listening… speak freely')
  if (dictation === 'starting') return tr('Ligando o microfone…', 'Turning on the microphone…')
  return withAgents
    ? tr(
        `Escreva, fale, cole um print (${keys('⌘V')}), / para comandos ou @ para agentes`,
        `Type, speak, paste a screenshot (${keys('⌘V')}), / for commands or @ for agents`
      )
    : tr(
        `Escreva, fale, cole um print (${keys('⌘V')}) ou digite / para comandos`,
        `Type, speak, paste a screenshot (${keys('⌘V')}) or type / for commands`
      )
}

const sendFailure = (err: unknown) => {
  const detail = err instanceof Error && err.message ? err.message : ''
  return tr(`Não deu para enviar. ${detail || 'Tente de novo.'}`, `Couldn’t send. ${detail || 'Try again.'}`)
}
