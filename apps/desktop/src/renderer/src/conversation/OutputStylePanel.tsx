import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { MENU_HOVER } from '../ui/menuStyles'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { tr } from '../i18n'

// Os estilos que já vêm no Claude Code, com as descrições do próprio `claude`, traduzidas.
const STYLES = [
  {
    value: 'default',
    label: tr('Padrão', 'Default'),
    description: tr('Faz as tarefas de código com eficiência e responde de forma direta.', 'Completes coding tasks efficiently and responds concisely.')
  },
  {
    value: 'Explanatory',
    label: tr('Explicativo', 'Explanatory'),
    description: tr('Explica as escolhas de implementação e os padrões do código.', 'Explains its implementation choices and the codebase patterns.')
  },
  {
    value: 'Learning',
    label: tr('Aprendizado', 'Learning'),
    description: tr('Pausa e pede para você escrever pequenos trechos de código, para praticar.', 'Pauses and asks you to write small pieces of code for hands-on practice.')
  }
]

// /output-style: escolhe o estilo de resposta, no lugar da tela que abriria no terminal. Como no
// `claude`, vale para a pasta.
export function OutputStylePanel({
  conversationKey,
  cwd,
  account,
  onClose
}: {
  conversationKey: string
  cwd: string
  account?: string
  onClose: () => void
}) {
  const [current, setCurrent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.api.chat.outputStyle(conversationKey, cwd, account).then((r) => {
      if (r.ok) setCurrent(r.style)
      else setError(r.error)
    })
  }, [conversationKey, cwd, account])

  const choose = async (style: string) => {
    if (style === current) return onClose()
    setSaving(true)
    const r = await window.api.chat.setOutputStyle(conversationKey, cwd, style)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    onClose()
  }

  return (
    <Modal label={tr('Estilo de resposta', 'Output style')} size="auto" className="flex w-[min(440px,100%)] flex-col" onClose={onClose}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{tr('Estilo de resposta', 'Output style')}</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-faint">{cwd}</div>
        </div>
        <ModalCloseButton />
      </header>

      <div className="px-2 py-2">
        {STYLES.map((s) => (
          <button
            key={s.value}
            disabled={current === null || saving}
            onClick={() => void choose(s.value)}
            className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left disabled:opacity-60 ${MENU_HOVER}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text">{s.label}</span>
              <span className="block text-xs text-faint">{s.description}</span>
            </span>
            {current?.toLowerCase() === s.value.toLowerCase() && <Check size={14} className="mt-0.5 text-muted" />}
          </button>
        ))}
        {error && <div className="px-2 pt-1 text-xs text-red-400">{error}</div>}
      </div>
    </Modal>
  )
}
