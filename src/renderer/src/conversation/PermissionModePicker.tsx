import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { MODES } from './permissionModes'
import { POPOVER } from './popover'
import { useClaudeInfo } from './useModels'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { Presence } from '../motion'
import { MenuArrow } from '../ui/MenuArrow'
import { MENU_HOVER } from '../ui/menuStyles'
import { tr } from '../i18n'

// A lista dos modos mora em permissionModes.ts; sai daqui também, como antes, para as Configurações.
export { MODES } from './permissionModes'

// `field`: nas Configurações. O botão tem cara de campo de seleção, o menu abre para baixo (para
// cima seria cortado com a página rolada), só com ícone e nome, e ganha o item "Padrão da conta"
// (valor vazio).
export function PermissionModePicker({
  value,
  onChange,
  field
}: {
  value: string
  onChange: (mode: string) => void
  field?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const info = useClaudeInfo()

  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  // Vazio = padrão da conta, que o claude informa ao iniciar.
  const effective = value || info?.defaultPermissionMode || 'manual'
  const current = MODES.find((m) => m.value === effective) ?? MODES[0]
  const Icon = current.icon
  const accountDefault = MODES.find((m) => m.value === info?.defaultPermissionMode)
  const options = field
    ? [{ value: '', label: tr('Padrão da conta', 'Account default') + (accountDefault ? ` - ${accountDefault.label}` : ''), description: '', icon: accountDefault?.icon ?? Icon, danger: accountDefault?.danger }, ...MODES]
    : MODES

  return (
    <div ref={ref} className="relative">
      {field ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-44 items-center gap-1.5 rounded-md border border-line bg-fill py-1 pl-2.5 pr-1 text-[12px] hover:border-line-strong"
        >
          <Icon size={13} className={current.danger ? 'text-red-400' : 'text-muted'} />
          <span className={`flex-1 text-left ${current.danger ? 'text-red-400' : 'text-text'}`}>
            {value ? current.label : tr('Padrão da conta', 'Account default')}
          </span>
          {/* A setinha num quadradinho na cor de destaque, como o Select das Configurações. */}
          <span className="ml-2 flex size-4 items-center justify-center rounded bg-accent text-white">
            <ChevronDown size={11} />
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          title={tr(`Modo: ${current.label}${value ? '' : ' (padrão)'}`, `Mode: ${current.label}${value ? '' : ' (default)'}`)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-text ${
            open ? 'bg-surface-2 text-text' : current.danger ? 'text-red-400' : 'text-muted'
          }`}
        >
          <Icon size={13} />
          <span>{current.label}</span>
          <ChevronUp size={12} className="text-faint" />
        </button>
      )}

      <Presence kind="menu">
        {open && (
          <div className={`absolute right-0 z-10 whitespace-normal ${field ? 'top-full mt-2.5 w-56' : 'bottom-full mb-2.5 w-80'} ${POPOVER}`}>
            <MenuArrow side={field ? 'top' : 'bottom'} align="end" />
            <div className="px-2 pb-1 pt-1.5 text-[12px] text-faint">{tr('Modo', 'Mode')}</div>
            {options.map((m) => {
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
                      {!field && m.value === info?.defaultPermissionMode && <span className="text-faint">{tr(' - padrão', ' - default')}</span>}
                    </span>
                    {!field && <span className="mt-0.5 block text-[12px] leading-snug text-faint">{m.description}</span>}
                  </span>
                  {(field ? value === m.value : effective === m.value) && <Check size={13} className="mt-0.5 shrink-0 text-muted" />}
                </button>
              )
            })}
          </div>
        )}
      </Presence>
    </div>
  )
}
