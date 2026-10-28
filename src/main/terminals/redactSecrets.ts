// Segredos no texto do terminal que vai para o Claude (ver drawerShells.ts) viram ***: o valor de
// NOME=valor quando o nome diz que é segredo (um .env impresso, um `env`), a senha dentro de um
// endereço (postgres://user:senha@host) e os formatos conhecidos de chave. Não pega tudo: uma senha
// solta numa linha, sem nome, passa.

const MASK = '***'

// Nome de variável que guarda segredo, em inglês ou português. PWD e OLDPWD são a pasta atual;
// PASSED, um contador.
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS(?!ED)|PWD|CREDENTIAL|PRIVATE|SIGNATURE|COOKIE|SESSION|SENHA|CHAVE|SEGREDO)/i
const NOT_SECRET = /^(PWD|OLDPWD)$/i

// NOME=valor, NOME: valor, "nome": "valor" (o export na frente não muda nada). O valor vai até o
// espaço, ou entre as aspas dele.
const ASSIGNMENT = /(["']?)([A-Za-z_][\w.-]*)\1(\s*[:=]\s*)(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"',;]+))/g

// Senha num endereço: esquema://usuário:senha@host.
const URL_PASSWORD = /([a-z][a-z\d+.-]*:\/\/[^\s:/@]+:)([^\s@/]+)(@)/gi

// Formatos com cara própria: Anthropic/OpenAI, GitHub, AWS, Slack, Stripe, Google, npm, JWT e chave
// privada (o bloco inteiro, ou do começo até o fim do texto, se o fim não veio).
const KNOWN = [
  /\bsk-[A-Za-z\d_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z\d]{20,}/g,
  /\bgithub_pat_[A-Za-z\d_]{20,}/g,
  /\b(?:AKIA|ASIA)[A-Z\d]{16}\b/g,
  /\bxox[abposr]-[A-Za-z\d-]{10,}/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z\d]{16,}/g,
  /\bAIza[\w-]{35}/g,
  /\bnpm_[A-Za-z\d]{36}\b/g,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g
]

// O texto com os segredos trocados e quantos foram trocados.
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0
  let out = text.replace(ASSIGNMENT, (whole, quote: string, name: string, sep: string, dq?: string, sq?: string, bare?: string) => {
    const value = dq ?? sq ?? bare ?? ''
    if (!value || value === MASK || !SECRET_NAME.test(name) || NOT_SECRET.test(name)) return whole
    count++
    const masked = dq !== undefined ? `"${MASK}"` : sq !== undefined ? `'${MASK}'` : MASK
    return `${quote}${name}${quote}${sep}${masked}`
  })
  out = out.replace(URL_PASSWORD, (_whole, head: string, _password: string, at: string) => {
    count++
    return `${head}${MASK}${at}`
  })
  for (const pattern of KNOWN) {
    out = out.replace(pattern, () => {
      count++
      return MASK
    })
  }
  return { text: out, count }
}
