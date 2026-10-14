import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import type { ProviderId } from '../../shared/providers'
import { errorMessage } from '../lib/errors'
import { providerAccountDir } from './paths'

// Chaves de API das contas por chave (Gemini; as outras do Cursor). Ficam na pasta da conta,
// cifradas pelo cofre do sistema (Chaves do macOS, DPAPI do Windows, o chaveiro do Linux): o arquivo
// sozinho não serve em outra máquina nem para outro usuário. Nunca vão para a tela; o CLI recebe a
// chave pelo ambiente, na hora de abrir.

const FILE = 'argus-key.bin'
// Sem cofre (Linux sem chaveiro): texto, só com permissão do dono. Melhor que não funcionar.
const PLAIN = 'argus-key.txt'

const fileOf = (provider: ProviderId, id: string, name: string) => {
  const dir = providerAccountDir(provider, id)
  return dir ? join(dir, name) : null
}

export function saveKey(provider: ProviderId, id: string, key: string): void {
  const dir = providerAccountDir(provider, id)
  if (!dir) throw new Error('a conta principal não usa chave')
  mkdirSync(dir, { recursive: true })
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(join(dir, FILE), safeStorage.encryptString(key), { mode: 0o600 })
    rmSync(join(dir, PLAIN), { force: true })
  } else {
    console.warn('[providers] cofre do sistema indisponível: chave guardada só com permissão do dono')
    writeFileSync(join(dir, PLAIN), key, { mode: 0o600 })
  }
}

export function readKey(provider: ProviderId, id: string): string | null {
  const enc = fileOf(provider, id, FILE)
  try {
    if (enc && existsSync(enc)) return safeStorage.decryptString(readFileSync(enc))
    const plain = fileOf(provider, id, PLAIN)
    if (plain && existsSync(plain)) return readFileSync(plain, 'utf8').trim()
  } catch (err) {
    console.error('[providers] não deu para ler a chave:', errorMessage(err))
  }
  return null
}

// Final da chave, para reconhecer qual é sem mostrar.
export const keyHint = (key: string) => `…${key.slice(-4)}`

// Formatos conhecidos, para reconhecer a chave copiada (ver clipboardKey).
export const KEY_PATTERNS: Record<'gemini' | 'cursor', RegExp> = {
  gemini: /^AIza[0-9A-Za-z_-]{35}$/,
  // Formato do Cursor sem documentação oficial: "key_" + letras e números (visto em detectores de
  // segredo). Colar à mão continua valendo para qualquer formato.
  cursor: /^key_[0-9A-Za-z]{32,}$/
}
