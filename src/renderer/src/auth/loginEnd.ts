import { loginEndingSoon, type Account } from '../../../shared/auth'
import { resetLabel, timeLeft } from '../canvas/bars/usageFormat'
import { tr } from '../i18n'

// Textos do prazo final do login de uma conta (ver Account.loginEndsAt): no cartão da conta, sempre
// que o prazo é conhecido; no painel dos limites e na barra, só quando falta pouco (loginEndingSoon).
// Passado o prazo, o Claude Code apaga o login e as conversas da conta param: entrar de novo antes
// começa um login novo, com prazo novo.

const iso = (ms: number) => new Date(ms).toISOString()

// "Login até sáb 14/11 às 02:04", ou o aviso quando falta pouco. Nulo sem prazo conhecido.
export function loginEndLine(status: Account | null | undefined, now: number): { text: string; soon: boolean } | null {
  const endsAt = status?.loggedIn ? status.loginEndsAt : undefined
  if (!endsAt) return null
  if (!loginEndingSoon(status, now)) return { text: tr(`Login até ${resetLabel(iso(endsAt), now)}`, `Signed in until ${resetLabel(iso(endsAt), now)}`), soon: false }
  if (endsAt <= now) return { text: tr('O login chegou ao prazo final: entre de novo.', 'The sign-in reached its time limit: sign in again.'), soon: true }
  return {
    text: tr(
      `O login termina em ${timeLeft(iso(endsAt), now)} (${resetLabel(iso(endsAt), now)}): entre de novo antes para não parar no meio de uma conversa.`,
      `The sign-in ends in ${timeLeft(iso(endsAt), now)} (${resetLabel(iso(endsAt), now)}): sign in again before then so a chat doesn’t stop midway.`
    ),
    soon: true
  }
}

// O aviso do painel dos limites, só quando falta pouco; o botão de entrar de novo vem logo abaixo
// (ver UsagePanel). place: "WSL (Ubuntu)", para o login de lá.
export function loginEndWarning(status: Account | null | undefined, now: number, place?: string): string | null {
  if (!loginEndingSoon(status, now)) return null
  const endsAt = status!.loginEndsAt!
  const where = place ? tr(` no ${place}`, ` in ${place}`) : ''
  if (endsAt <= now)
    return tr(`O login desta conta${where} chegou ao prazo final: entre de novo.`, `This account’s sign-in${where} reached its time limit: sign in again.`)
  return tr(
    `O login desta conta${where} termina em ${timeLeft(iso(endsAt), now)} (${resetLabel(iso(endsAt), now)}). Entre de novo antes para não parar no meio de uma conversa.`,
    `This account’s sign-in${where} ends in ${timeLeft(iso(endsAt), now)} (${resetLabel(iso(endsAt), now)}). Sign in again before then so a chat doesn’t stop midway.`
  )
}
