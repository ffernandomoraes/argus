import { join } from 'node:path'
import { app } from 'electron'
import { usableUsage, type Usage, type UsageWindow } from '../../shared/usage'
import { errorMessage } from '../lib/errors'
import { readJsonFile, writeJsonAtomic } from '../lib/jsonFile'

// Último uso lido de cada conta, guardado em usage.json (na pasta de dados), para a tela não ficar
// sem os limites ao abrir o app enquanto o `claude` (ou o Codex) ainda não respondeu, ou se a
// conferência do login demorar. Nunca pode mostrar o uso de outra conta: cada valor guarda o
// e-mail do login que o gerou e só aparece depois de esse mesmo e-mail ser confirmado nesta
// abertura (trust ou confirm). Login diferente, conta que saiu ou foi removida: o valor é apagado.
// O que já venceu pelo relógio, quem filtra é usableUsage (shared/usage.ts).

type Entry = { usage: Usage; email: string }

// Conferência do login, no formato comum a Claude e Codex. null: não deu para conferir (mantém).
export type LoginCheck = { signedIn: boolean; email?: string } | null

const file = () => join(app.getPath('userData'), 'usage.json')

const isWindow = (w: unknown): w is UsageWindow =>
  !!w &&
  typeof (w as UsageWindow).percent === 'number' &&
  ((w as UsageWindow).resetsAt === null || typeof (w as UsageWindow).resetsAt === 'string')

// Só o formato esperado; o resto é ignorado.
function validEntry(e: unknown): e is Entry {
  const u = (e as Entry | null)?.usage
  return (
    typeof (e as Entry | null)?.email === 'string' &&
    !!u &&
    typeof u.updatedAt === 'number' &&
    (u.session === null || isWindow(u.session)) &&
    (u.weekly === null || isWindow(u.weekly)) &&
    Array.isArray(u.models) &&
    u.models.every((m) => typeof m?.name === 'string' && isWindow(m.window))
  )
}

export class SavedUsages {
  private entries = new Map<string, Entry>()
  // Contas cujo login desta abertura é o mesmo do valor guardado.
  private trusted = new Set<string>()

  constructor() {
    const read = readJsonFile<Record<string, unknown>>(file())
    if (read.status === 'corrupt') console.warn('[usage] usage.json ilegível, começa vazio:', read.error)
    if (read.status !== 'ok' || !read.data || typeof read.data !== 'object') return
    const now = Date.now()
    for (const [key, e] of Object.entries(read.data)) {
      if (!validEntry(e)) continue
      // Já vencido: nem entra.
      if (!usableUsage({ ...e.usage, saved: true }, now)?.session) continue
      this.entries.set(key, { usage: { ...e.usage, saved: undefined }, email: e.email })
    }
  }

  // O guardado da conta, se pode aparecer (login conferido), marcado como guardado.
  get(key: string): Usage | null {
    const e = this.entries.get(key)
    return e && this.trusted.has(key) ? { ...e.usage, saved: true } : null
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }

  // E-mail do login atual lido sem rodar nada (o .claude.json da conta): libera o guardado na hora,
  // se for o mesmo. Diferente não apaga: quem decide é a conferência do login (confirm).
  // true: passou a poder aparecer.
  trust(key: string, email: string | undefined): boolean {
    const e = this.entries.get(key)
    if (!e || !email || e.email !== email || this.trusted.has(key)) return false
    this.trusted.add(key)
    return true
  }

  // Resultado da conferência do login. Mesmo e-mail: libera. Outro, sem e-mail ou sem login: apaga.
  // Sem resposta (null): nada muda. 'shown': passou a poder aparecer; 'gone': apagado o que estava
  // à vista; null: nada que a tela precise saber.
  confirm(key: string, check: LoginCheck): 'shown' | 'gone' | null {
    if (!check || !this.entries.has(key)) return null
    const e = this.entries.get(key)!
    if (check.signedIn && check.email && check.email === e.email) {
      if (this.trusted.has(key)) return null
      this.trusted.add(key)
      return 'shown'
    }
    return this.forget(key) ? 'gone' : null
  }

  // Leitura nova da conta. Sem e-mail (login por chave de API, por exemplo) não guarda: não teria
  // como conferir de quem é na próxima abertura.
  remember(key: string, usage: Usage, email: string | undefined): void {
    if (!email) {
      this.forget(key)
      return
    }
    this.entries.set(key, { usage: { ...usage, saved: undefined }, email })
    this.trusted.add(key)
    this.persist()
  }

  // true se estava à vista.
  forget(key: string): boolean {
    const shown = this.trusted.has(key)
    this.trusted.delete(key)
    if (this.entries.delete(key)) this.persist()
    return shown
  }

  private persist(): void {
    writeJsonAtomic(file(), Object.fromEntries(this.entries), { mode: 0o600 }).catch((err) =>
      console.warn('[usage] não deu para gravar o usage.json:', errorMessage(err))
    )
  }
}
