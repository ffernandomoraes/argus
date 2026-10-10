import { accountIds, defaultAccount } from '../accounts'
import { requestRefresh } from './refresh'
import { readStored, writeStored, type OAuth } from './store'

// Login do Claude Code (o mesmo que o Agent SDK usa), para chamadas que não passam pelo SDK, como
// a transcrição do ditado. Renova o acesso como o Claude Code faz e grava o novo de volta, para o
// Claude Code seguir usando.

// Renova um pouco antes de vencer, para não cair no meio de um ditado.
const MARGIN_MS = 5 * 60_000

// Renova e grava. Se não der para guardar o login novo, conta como renovação que falhou (quem
// chama segue com o que tinha, como em qualquer falha).
async function refresh(account: string, current: OAuth): Promise<OAuth | null> {
  const next = await requestRefresh(current)
  if (!next) return null
  // O Claude Code pode ter renovado ao mesmo tempo; nesse caso vale o que ele gravou.
  const stored = await readStored(account)
  // Sem ler o que está guardado, gravar só o login apagaria o resto do item (os logins dos MCPs,
  // por exemplo): não grava.
  if (!stored) {
    console.warn('[claudeAuth] login renovado, mas não deu para reler o guardado; nada foi gravado')
    return null
  }
  if (stored.claudeAiOauth && stored.claudeAiOauth.refreshToken !== current.refreshToken) return stored.claudeAiOauth
  if (!(await writeStored(account, { ...stored, claudeAiOauth: next }))) {
    console.warn('[claudeAuth] não deu para gravar o login renovado')
    return null
  }
  return next
}

// A conta padrão primeiro; sem login nela, as outras (a principal antes das adicionadas).
async function findToken(): Promise<string | null> {
  const order = [...new Set([defaultAccount(), ...accountIds()])]
  // Vencido e sem conseguir renovar: fica de reserva, se nenhuma conta tiver um válido.
  let stale: string | null = null
  for (const account of order) {
    const oauth = (await readStored(account))?.claudeAiOauth
    if (!oauth?.accessToken) continue
    if (!oauth.expiresAt || Date.now() + MARGIN_MS < oauth.expiresAt) return oauth.accessToken
    const renewed = await refresh(account, oauth)
    if (renewed) return renewed.accessToken
    stale ??= oauth.accessToken
  }
  // Se renovar falhar, tenta com o que tem: o serviço responde se não valer mais.
  return stale
}

let pending: Promise<string | null> | null = null

// Token de acesso válido, ou null sem login do Claude Code em nenhuma conta. Nunca rejeita.
export function claudeAccessToken(): Promise<string | null> {
  pending ??= findToken()
    .catch(() => null)
    .finally(() => {
      pending = null
    })
  return pending
}
