import { execFileSync } from 'node:child_process'

// Segredos do app instalado no Mac, nas Chaves, gravados e lidos pelo `/usr/bin/security`.
//
// Por que não o safeStorage do Electron: o certificado do Argus é autoassinado (sem Team ID da Apple),
// então o macOS prende a permissão do item "Argus Safe Storage" ao cdhash do binário, que muda a cada
// build: toda versão nova pedia a senha das Chaves (2026-11-13). O item criado pelo `security` fica
// preso à assinatura da Apple do próprio `security` (partição apple-tool:), que não muda com o Argus:
// nenhum pedido, em versão nenhuma. É como o Claude Code guarda o login dele.
//
// O segredo vai em base64 (só letras, números, + / =): passa pelo modo interativo do `security` sem
// problema de aspas ou espaços, e o `-w` da leitura devolve como texto. E vai pela entrada padrão
// (`security -i`), não pelos argumentos, para não aparecer na lista de processos.

const SERVICE = 'Argus'
// Código de saída do `security` quando o item não existe.
const NOT_FOUND = 44
const MAX_ENCODED = 3_000

// Leitura síncrona em quem chama (status da conta, ambiente do CLI): sem cache, cada uma abriria um
// processo. Guarda também o "não existe".
const cache = new Map<string, string | null>()

// O nome vai sem aspas no modo interativo: só letras, números, ponto e hífen.
const checked = (account: string) => {
  if (!/^[\w.-]+$/.test(account)) throw new Error(`nome inválido para as Chaves: ${account}`)
  return account
}

const run = (args: string[], input?: string) =>
  execFileSync('/usr/bin/security', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10_000 })

// null: não existe. Erro de verdade (Chaves trancadas, `security` que falhou): exceção.
export function keychainRead(account: string): string | null {
  checked(account)
  if (cache.has(account)) return cache.get(account)!
  let value: string | null
  try {
    value = Buffer.from(run(['find-generic-password', '-s', SERVICE, '-a', account, '-w']).trim(), 'base64').toString('utf8')
  } catch (err) {
    if ((err as { status?: number }).status !== NOT_FOUND) throw err
    value = null
  }
  cache.set(account, value)
  return value
}

export function keychainWrite(account: string, secret: string): void {
  checked(account)
  cache.delete(account)
  const encoded = Buffer.from(secret, 'utf8').toString('base64')
  // O modo interativo corta a linha em ~4.000 caracteres, e o resto vira outro comando (com o segredo
  // no erro). Segredo grande vai cifrado em arquivo, com só a chave aqui (ver remote/store.ts).
  if (encoded.length > MAX_ENCODED) throw new Error('segredo grande demais para as Chaves')
  // -U: substitui o que já existir com o mesmo nome. O modo interativo não devolve erro pelo código
  // de saída: confere lendo de volta.
  run(['-i'], `add-generic-password -U -s ${SERVICE} -a ${account} -w ${encoded}\n`)
  if (keychainRead(account) !== secret) {
    cache.delete(account)
    throw new Error('as Chaves não guardaram o segredo')
  }
}

export function keychainDelete(account: string): void {
  checked(account)
  cache.delete(account)
  try {
    run(['delete-generic-password', '-s', SERVICE, '-a', account])
  } catch (err) {
    if ((err as { status?: number }).status !== NOT_FOUND) throw err
  }
}
