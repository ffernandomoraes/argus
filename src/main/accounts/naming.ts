import { MAIN_ACCOUNT, type Account } from '../../shared/auth'
import { tr } from '../i18n'

// Nome sugerido: o da pessoa na conta. Sem ele, o da organização, quando é empresa. Plano
// individual vira "Pessoal"; o Claude chama a organização dele de "<alguém>'s Organization".
export function suggestedName(id: string, status: Account | null, taken: Set<string>): string {
  // O nome da pessoa na conta vem primeiro. Duas contas da mesma pessoa (pessoal e da empresa):
  // a segunda leva a organização junto, para dar para distinguir na escolha de conta dos grupos.
  const person = status?.userName
  if (person) return taken.has(person) ? `${person} - ${status.organization ?? status.email}` : person
  const org = status?.organization
  const individual = ['free', 'pro', 'max'].includes(status?.subscriptionType ?? '') || /'s organi[sz]ation$/i.test(org ?? '')
  if (org && !individual) return org
  const personal = tr('Pessoal', 'Personal')
  if (status?.email) return taken.has(personal) ? status.email.split('@')[0] : personal
  return id === MAIN_ACCOUNT ? tr('Principal', 'Main') : tr('Conta', 'Account')
}
