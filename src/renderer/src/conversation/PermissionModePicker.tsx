import { useRef, useState } from 'react'
import { Check, ChevronUp } from 'lucide-react'
import { MODES } from './permissionModes'
import { POPOVER } from './popover'
import { useClaudeInfo } from './useModels'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { Presence } from '../motion'
import { MenuArrow } from '../ui/MenuArrow'
import { MENU_HOVER } from '../ui/menuStyles'

// A lista dos modos mora em permissionModes.ts; sai daqui também, como antes, para as Configurações.
export { MODES } from './permissionModes'

export function PermissionModePicker({ value, onChange }: { value: string; onChange: (mode: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const info = useClaudeInfo()

  useOutsideClick(ref, () => setOpen(false), open)
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
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-text ${
          open ? 'bg-surface-2 text-text' : current.danger ? 'text-red-400' : 'text-muted'
        }`}
      >
        <Icon size={13} />
        <span>{current.label}</span>
        <ChevronUp size={12} className="text-faint" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className={`absolute bottom-full right-0 z-10 mb-2.5 w-80 whitespace-normal ${POPOVER}`}>
            <MenuArrow side="bottom" align="end" />
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
