import { useEffect, useRef, useState } from 'react'
import { Check, ChevronUp, FilePen, Hand, ListChecks, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react'
import { useClaudeInfo } from './useModels'
import { useEscape } from '../useEscape'
import { Presence } from '../motion'
import { MENU_HOVER } from '../canvas/ContextMenu'

// Modos de permissão do --permission-mode, com nomes e descrições da extensão do VS Code, traduzidos.
export const MODES: { value: string; label: string; description: string; icon: LucideIcon; danger?: boolean }[] = [
  { value: 'manual', label: 'Manual', description: 'Pede aprovação antes de cada edição.', icon: Hand },
  { value: 'acceptEdits', label: 'Editar automaticamente', description: 'Edita os arquivos sem pedir aprovação.', icon: FilePen },
  { value: 'plan', label: 'Plano', description: 'Explora o código e apresenta um plano antes de editar.', icon: ListChecks },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Aprova o que passa numa checagem de segurança e para no que for arriscado.',
    icon: ShieldCheck
  },
  {
    value: 'bypassPermissions',
    label: 'Ignorar permissões',
    description: 'Não pede aprovação nem para comandos potencialmente perigosos.',
    icon: ShieldOff,
    danger: true
  }
]

export function PermissionModePicker({ value, onChange }: { value: string; onChange: (mode: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const info = useClaudeInfo()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  useEscape(() => setOpen(false), open)

  // Vazio = padrão da conta, que o claude informa ao iniciar.
  const effective = value || info?.defaultPermissionMode || 'manual'
  const current = MODES.find((m) => m.value === effective) ?? MODES[0]
  const Icon = current.icon

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Modo: ${current.label}${value ? '' : ' (padrão)'}`}
        className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs hover:bg-surface-2 hover:text-text ${
          open ? 'bg-surface-2 text-text' : current.danger ? 'text-red-400' : 'text-muted'
        }`}
      >
        <Icon size={13} />
        <span>{current.label}</span>
        <ChevronUp size={12} className="text-faint" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className="absolute bottom-full right-0 z-10 mb-2 w-80 rounded-xl border border-line bg-surface/90 p-1 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="px-2 pb-1 pt-1.5 text-[12px] text-faint">Modo</div>
            {MODES.map((m) => {
              const ModeIcon = m.icon
              return (
                <button
                  key={m.value}
                  onClick={() => {
                    onChange(m.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left ${MENU_HOVER}`}
                >
                  <ModeIcon size={14} className={`mt-0.5 shrink-0 ${m.danger ? 'text-red-400' : 'text-muted'}`} />
                  <span className="flex-1">
                    <span className={`block text-xs ${m.danger ? 'text-red-400' : 'text-text'}`}>
                      {m.label}
                      {m.value === info?.defaultPermissionMode && <span className="text-faint"> - padrão</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-faint">{m.description}</span>
                  </span>
                  {effective === m.value && <Check size={13} className="mt-0.5 shrink-0 text-muted" />}
                </button>
              )
            })}
          </div>
        )}
      </Presence>
    </div>
  )
}
