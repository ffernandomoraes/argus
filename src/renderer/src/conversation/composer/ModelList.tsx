import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { ClaudeModel } from '../../../../shared/models'
import { Presence } from '../../motion'
import { MENU_ACTIVE, MENU_HOVER } from '../../ui/menuStyles'
import { groupByFamily } from '../modelOptions'
import { POPOVER } from '../popover'

const PICKER_ROW = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text ${MENU_HOVER}`

// Modelos do menu, agrupados por família ("Opus", "Sonnet"...), com as versões num submenu ao lado.
// O padrão do Claude Code vem primeiro, com o modelo a que aponta hoje. Nasce com o submenu fechado:
// o menu monta de novo a cada vez que abre.
export function ModelList({
  models,
  value,
  onChange
}: {
  models: ClaudeModel[]
  value: string
  onChange: (model: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const defaultModel = models.find((m) => m.value === '')

  return (
    // Sem rolagem aqui: o submenu das versões sai para o lado e seria cortado
    <div>
      <div className="px-2 pb-1 pt-1.5 text-[12px] text-faint">Modelo</div>
      {models.length === 0 && <div className="px-2 py-1.5 text-xs text-faint">Carregando modelos…</div>}

      {defaultModel && (
        <button onClick={() => onChange('')} className={PICKER_ROW}>
          <span className="flex-1">
            Padrão
            {defaultModel.resolvedName && <span className="text-faint"> - {defaultModel.resolvedName}</span>}
          </span>
          {value === '' && <Check size={13} className="text-muted" />}
        </button>
      )}

      {groupByFamily(models).map(([family, versions]) => {
        const selected = versions.find((v) => v.value === value)
        const isOpen = expanded === family
        return (
          <div
            key={family}
            className="relative"
            onMouseEnter={() => setExpanded(family)}
            onMouseLeave={() => setExpanded((f) => (f === family ? null : f))}
          >
            <button onClick={() => setExpanded(isOpen ? null : family)} className={`${PICKER_ROW} ${isOpen ? MENU_ACTIVE : ''}`}>
              <span className="flex-1">{family}</span>
              {selected && <span className="text-[12px] text-faint">{selected.displayName}</span>}
              {selected && <Check size={13} className="text-muted" />}
              <ChevronRight size={12} className="shrink-0 text-faint" />
            </button>
            {/* Submenu ao lado; o pl-1 mantém o mouse "dentro" ao atravessar o vão */}
            <Presence kind="menu">
              {isOpen && (
                <div className="absolute left-full top-0 z-10 pl-1">
                  <div className={`w-44 ${POPOVER}`}>
                    {versions.map((v) => (
                      <button key={v.value} onClick={() => onChange(v.value)} className={PICKER_ROW}>
                        <span className="flex-1">{v.displayName}</span>
                        {value === v.value && <Check size={13} className="text-muted" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Presence>
          </div>
        )
      })}
    </div>
  )
}
