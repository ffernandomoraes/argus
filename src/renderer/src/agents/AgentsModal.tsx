import { useState } from 'react'
import { ArrowLeft, Bot, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import { useSaveShortcut } from '../lib/useSaveShortcut'
import { Presence } from '../motion'
import { IS_WIN, tildify } from '../platform'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { AgentEditor } from './AgentEditor'
import { AgentList } from './AgentList'
import { useAgentDraft } from './useAgentDraft'
import { tr } from '../i18n'

// Biblioteca de agentes globais: os arquivos de ~/.claude/agents, que valem em todo projeto
// (aqui, no terminal e no VS Code). O app só lê e grava esses arquivos.
export function AgentsModal({ onClose }: { onClose: () => void }) {
  const agent = useAgentDraft()
  const { draft, dirty } = agent
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  // Com alteração, pergunta antes de descartar; sem, segue direto.
  const discardThen = (then: () => void) => {
    if (!dirty) return then()
    setConfirm({
      title: tr('Descartar as alterações deste agente?', 'Discard changes to this agent?'),
      description: tr('O que você mudou desde a última vez que salvou se perde.', 'Changes since you last saved will be lost.'),
      confirmLabel: tr('Descartar', 'Discard'),
      onConfirm: then
    })
  }
  const back = () => discardThen(agent.close)
  const askRemove = (name: string) =>
    setConfirm({
      title: tr(`Excluir o agente ${name}?`, `Delete agent ${name}?`),
      description: tr('O arquivo dele é apagado.', 'Its file will be deleted.'),
      confirmLabel: tr('Excluir', 'Delete'),
      onConfirm: () => void agent.remove()
    })

  // ⌘S salva.
  useSaveShortcut(agent.save)

  return (
    <Modal
      label={tr('Agentes', 'Agents')}
      size="2xl"
      className="flex"
      onClose={onClose}
      onRequestClose={() => {
        if (!dirty) return true
        discardThen(onClose)
        return false
      }}
      // ESC volta uma camada: do agente aberto para a lista, depois fecha a janela.
      onEscape={draft ? back : undefined}
    >
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start gap-3 border-b border-line px-5 py-3">
          {draft ? (
            <IconButton label={tr('Voltar para os agentes', 'Back to agents')} onClick={back}>
              <ArrowLeft size={15} />
            </IconButton>
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center text-muted">
              <Bot size={16} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{draft ? (draft.previousName ?? tr('Novo agente', 'New agent')) : tr('Agentes', 'Agents')}</div>
            <div className="mt-0.5 truncate font-mono text-[12px] text-faint">
              {agent.current ? tildify(agent.current.path) : IS_WIN ? '~\\.claude\\agents\\' : '~/.claude/agents/'}
            </div>
          </div>
          {!draft && agent.loaded && agent.agents.length > 0 && (
            <Button size="lg" variant="primary" onClick={agent.create}>
              <Plus size={12} />
              {tr('Novo agente', 'New agent')}
            </Button>
          )}
          {draft?.previousName && (
            <Button size="sm" variant="ghost" danger title={tr('Excluir', 'Delete')} onClick={() => askRemove(draft.previousName!)}>
              <Trash2 size={12} />
              {tr('Excluir', 'Delete')}
            </Button>
          )}
          <ModalCloseButton />
        </header>

        {!draft ? (
          agent.loaded && <AgentList agents={agent.agents} onSelect={agent.select} onCreate={agent.create} />
        ) : (
          <AgentEditor
            draft={draft}
            step={agent.step}
            reached={agent.reached}
            error={agent.error}
            dirty={dirty}
            lacking={agent.lacking}
            canSave={agent.canSave}
            onGo={agent.go}
            onBack={back}
            onSave={() => void agent.save()}
            onChange={agent.set}
            onToggleTool={agent.toggleTool}
          />
        )}
      </section>
      <Presence kind="modal">{confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}</Presence>
    </Modal>
  )
}
