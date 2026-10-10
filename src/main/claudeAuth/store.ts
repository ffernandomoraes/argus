import { execFile, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { accountDir } from '../accounts'
import { keychainAccount, keychainService } from '../accounts/keychain'
import { writeStdin } from '../lib/childProcess'
import { writeJsonAtomic } from '../lib/jsonFile'
import { IS_MAC } from '../platform'

// Onde o Claude Code guarda o login de cada conta: nas Chaves do macOS no Mac (um item por pasta
// de configuração, ver accounts/keychain.ts); no Windows, no .credentials.json da pasta da conta
// (o da principal em ~/.claude).

export type OAuth = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshTokenExpiresAt?: number
  scopes?: string[]
  subscriptionType?: unknown
  rateLimitTier?: unknown
}
// O item guarda mais que o login do Claude (os logins dos MCPs, por exemplo): gravar sempre por
// cima do que foi lido, nunca só o claudeAiOauth.
export type Stored = { claudeAiOauth?: OAuth } & Record<string, unknown>

const run = promisify(execFile)
// Comando mais longo que o `security -i` aceita no stdin; acima disso, o Claude Code passa pelos
// argumentos (conferido na 2.1.295). Aqui, igual.
const STDIN_LIMIT = 4032

const credentialsFile = (account: string) =>
  join(accountDir(account) ?? join(homedir(), '.claude'), '.credentials.json')

// null sem login guardado, ou se não deu para ler.
export async function readStored(account: string): Promise<Stored | null> {
  try {
    if (!IS_MAC) return JSON.parse(await readFile(credentialsFile(account), 'utf8')) as Stored
    const service = keychainService(accountDir(account))
    const { stdout } = await run('security', ['find-generic-password', '-a', keychainAccount(), '-s', service, '-w'])
    return JSON.parse(stdout.trim()) as Stored
  } catch {
    return null
  }
}

// No Mac, pelo stdin do `security`, para o login não aparecer na lista de processos (grande
// demais para o stdin, vai pelos argumentos, como o Claude Code faz). No Windows, gravação
// atômica: o Claude Code lendo ao mesmo tempo vê o arquivo antigo ou o novo, nunca pela metade.
// false: não gravou.
export async function writeStored(account: string, data: Stored): Promise<boolean> {
  if (!IS_MAC) {
    return writeJsonAtomic(credentialsFile(account), data, { mode: 0o600 }).then(
      () => true,
      () => false
    )
  }
  const hex = Buffer.from(JSON.stringify(data), 'utf-8').toString('hex')
  const user = keychainAccount()
  const service = keychainService(accountDir(account))
  const command = `add-generic-password -U -a "${user}" -s "${service}" -X "${hex}"\n`
  if (command.length > STDIN_LIMIT) {
    return run('security', ['add-generic-password', '-U', '-a', user, '-s', service, '-X', hex]).then(
      () => true,
      () => false
    )
  }
  return new Promise((resolve) => {
    const proc = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'ignore'] })
    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))
    writeStdin(proc, command)
  })
}
