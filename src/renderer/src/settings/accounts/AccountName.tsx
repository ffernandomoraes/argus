import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { ClaudeAccount } from '../../../../shared/auth'

// Apelido editável no próprio card: Enter grava, Esc desiste. Vazio volta para o nome sugerido.
export function AccountName({ account }: { account: ClaudeAccount }) {
  const [value, setValue] = useState<string | null>(null)
  // O campo some ao terminar, e sumir também tira o foco: o blur que vem junto não grava de novo
  // (nem grava depois de um Esc).
  const finished = useRef(false)

  if (value === null) {
    return (
      <button
        onClick={() => {
          finished.current = false
          setValue(account.name)
        }}
        title="Trocar o apelido"
        className="group/name flex min-w-0 items-center gap-1.5 text-left"
      >
        <span className="truncate text-sm text-text">{account.name}</span>
        <Pencil size={11} className="shrink-0 text-faint opacity-0 group-hover/name:opacity-100" />
      </button>
    )
  }

  const done = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    setValue(null)
    if (save && value.trim() !== account.name) window.api.auth.rename(account.id, value)
  }
  return (
    <input
      autoFocus
      value={value}
      maxLength={40}
      aria-label="Apelido da conta"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(true)
        if (e.key === 'Escape') {
          // O Esc fica aqui: não fecha as configurações.
          e.preventDefault()
          done(false)
        }
      }}
      className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-0.5 text-sm text-text outline-none focus:border-accent"
    />
  )
}
