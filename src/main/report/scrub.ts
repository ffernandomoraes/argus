// Tira do relatório o que não pode sair da máquina: tokens de acesso e chaves. O email fica só com
// a primeira letra e o domínio, que bastam para ver se duas contas são a mesma.

const SECRETS: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-<oculto>'],
  [/("(?:accessToken|refreshToken|access_token|refresh_token|id_token|apiKey|api_key|primaryApiKey|token)"\s*:\s*")[^"]*(")/gi, '$1<oculto>$2'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, '$1<oculto>'],
  [/\b((?:ANTHROPIC|OPENAI|GEMINI|GOOGLE|CURSOR)_[A-Z_]*(?:KEY|TOKEN)\s*[=:]\s*)\S+/g, '$1<oculto>']
]

const EMAIL = /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g

export function scrub(text: string): string {
  let out = text
  for (const [re, to] of SECRETS) out = out.replace(re, to)
  return out.replace(EMAIL, '$1***@$2')
}

// Arquivos que guardam login ou chave: a investigação não lê (ver tools.ts).
export const SECRET_FILE = /(\.credentials\.json|auth\.json|\.env(\.|$)|id_rsa|id_ed25519|\.pem$|\.key$|\.netrc|\.git-credentials|keychain)/i
