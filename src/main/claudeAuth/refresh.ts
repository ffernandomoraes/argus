import type { OAuth } from './store'

// Renovação do acesso, o mesmo pedido que o Claude Code faz quando o token vence.
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token'
const CLIENT_ID = '22422756-60c9-4084-8eb7-27705fd5cf9a'

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  refresh_token_expires_in?: number
  scope?: string
}

// O login renovado, ou null se não deu (sem refresh token, recusado, sem conexão). Só pede: quem
// chama decide se grava.
export async function requestRefresh(current: OAuth): Promise<OAuth | null> {
  if (!current.refreshToken) return null
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: CLIENT_ID,
        ...(current.scopes?.length ? { scope: current.scopes.join(' ') } : {})
      }),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    const body = (await res.json()) as TokenResponse
    return {
      ...current,
      accessToken: body.access_token,
      refreshToken: body.refresh_token || current.refreshToken,
      expiresAt: Date.now() + body.expires_in * 1000,
      ...(typeof body.refresh_token_expires_in === 'number' && {
        refreshTokenExpiresAt: Date.now() + body.refresh_token_expires_in * 1000
      }),
      scopes: body.scope ? body.scope.split(' ') : current.scopes
    }
  } catch {
    return null
  }
}
