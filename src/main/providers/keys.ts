import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { ProviderId } from '../../shared/providers'
import { errorMessage } from '../lib/errors'
import { keychainDelete, keychainRead, keychainWrite } from '../lib/macKeychain'
import { providerAccountDir } from './paths'

// Chaves de API das contas por chave (Gemini; as outras do Cursor). Nunca vão para a tela; o CLI
// recebe a chave pelo ambiente, na hora de abrir. Onde ficam:
//
// - App instalado no Mac: nas Chaves, pelo `security` (ver lib/macKeychain.ts). O safeStorage pedia a
//   senha das Chaves a cada versão nova (2026-11-13). A cifrada de antes (argus-key.bin) é lida uma
//   última vez pelo safeStorage, passa para as Chaves e é apagada.
// - App instalado no Windows e no Linux: na pasta da conta, cifrada pelo cofre do sistema (DPAPI, o
//   chaveiro do Linux): o arquivo sozinho não serve em outra máquina nem para outro usuário.
// - pnpm dev: sem cofre. O Electron de desenvolvimento tem assinatura provisória, que muda a cada
//   versão do Electron, e cada atualização fazia o macOS pedir a senha das Chaves (2026-10-23). A
//   chave fica em texto, só com permissão do dono, na pasta de dados do dev (~/.argus-dev).

const FILE = 'argus-key.bin'
// Sem cofre (Linux sem chaveiro, e o pnpm dev): texto, só com permissão do dono. Melhor que não
// funcionar.
const PLAIN = 'argus-key.txt'

const macKeychain = () => app.isPackaged && process.platform === 'darwin'
// No dev nem pergunta ao cofre: no macOS a própria pergunta (isEncryptionAvailable) já lê as Chaves.
const vault = () => app.isPackaged && process.platform !== 'darwin' && safeStorage.isEncryptionAvailable()

const keychainAccount = (provider: ProviderId, id: string) => `key-${provider}-${id}`

const fileOf = (provider: ProviderId, id: string, name: string) => {
  const dir = providerAccountDir(provider, id)
  return dir ? join(dir, name) : null
}

export function saveKey(provider: ProviderId, id: string, key: string): void {
  const dir = providerAccountDir(provider, id)
  if (!dir) throw new Error('a conta principal não usa chave')
  mkdirSync(dir, { recursive: true })
  if (macKeychain()) {
    keychainWrite(keychainAccount(provider, id), key)
    rmSync(join(dir, FILE), { force: true })
    rmSync(join(dir, PLAIN), { force: true })
  } else if (vault()) {
    writeFileSync(join(dir, FILE), safeStorage.encryptString(key), { mode: 0o600 })
    rmSync(join(dir, PLAIN), { force: true })
  } else {
    if (app.isPackaged) console.warn('[providers] cofre do sistema indisponível: chave guardada só com permissão do dono')
    writeFileSync(join(dir, PLAIN), key, { mode: 0o600 })
    // A cifrada de antes (o dev também guardava no cofre) não serve mais: a nova vale.
    rmSync(join(dir, FILE), { force: true })
  }
}

export function readKey(provider: ProviderId, id: string): string | null {
  const enc = fileOf(provider, id, FILE)
  try {
    if (macKeychain() && providerAccountDir(provider, id)) {
      const key = keychainRead(keychainAccount(provider, id))
      if (key !== null) return key
      // Guardada pelo safeStorage numa versão anterior: a última vez que pede a senha das Chaves.
      if (enc && existsSync(enc)) {
        const legacy = safeStorage.decryptString(readFileSync(enc))
        try {
          keychainWrite(keychainAccount(provider, id), legacy)
          rmSync(enc, { force: true })
        } catch (err) {
          // Fica a cifrada, para tentar de novo na próxima leitura; a chave vale mesmo assim.
          console.error('[providers] não deu para passar a chave para as Chaves:', errorMessage(err))
        }
        return legacy
      }
    } else if (app.isPackaged && enc && existsSync(enc)) {
      // No dev a cifrada fica de fora: abrir pediria a senha das Chaves. A conta pede a chave de novo.
      return safeStorage.decryptString(readFileSync(enc))
    }
    const plain = fileOf(provider, id, PLAIN)
    if (plain && existsSync(plain)) return readFileSync(plain, 'utf8').trim()
  } catch (err) {
    console.error('[providers] não deu para ler a chave:', errorMessage(err))
  }
  return null
}

// Conta apagada: a pasta (com os arquivos) sai por quem chama; nas Chaves, sai aqui.
export function deleteKey(provider: ProviderId, id: string): void {
  if (!macKeychain() || !providerAccountDir(provider, id)) return
  try {
    keychainDelete(keychainAccount(provider, id))
  } catch (err) {
    console.warn('[providers] não deu para tirar a chave das Chaves:', errorMessage(err))
  }
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
