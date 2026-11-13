import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteKey, readKey, saveKey } from './keys'
import { providerAccountDir } from './paths'

// As Chaves de mentira (o `security` de verdade não roda nos testes).
const keychain = vi.hoisted(() => new Map<string, string>())
vi.mock('../lib/macKeychain', () => ({
  keychainRead: vi.fn((account: string) => keychain.get(account) ?? null),
  keychainWrite: vi.fn((account: string, secret: string) => void keychain.set(account, secret)),
  keychainDelete: vi.fn((account: string) => void keychain.delete(account))
}))

// O cofre de mentira: cifra só pondo um prefixo, e conta quem perguntou por ele.
const vault = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((text: string) => Buffer.from(`cifrado:${text}`)),
  decryptString: vi.fn((data: Buffer) => data.toString().replace(/^cifrado:/, ''))
}
const real = { isPackaged: app.isPackaged, ...safeStorage }
const realPlatform = process.platform
const asPlatform = (platform: NodeJS.Platform) => Object.defineProperty(process, 'platform', { value: platform })

const ACCOUNT = 'f612176c'
// A pasta muda com o app instalado ou não (~/.argus ou ~/.argus-dev): lida na hora.
const dir = () => providerAccountDir('gemini', ACCOUNT)!

function packaged(on: boolean): void {
  Object.assign(app, { isPackaged: on })
  Object.assign(safeStorage, vault)
}

afterEach(() => {
  rmSync(dir(), { recursive: true, force: true })
  Object.assign(app, { isPackaged: real.isPackaged })
  Object.assign(safeStorage, { isEncryptionAvailable: real.isEncryptionAvailable })
  asPlatform(realPlatform)
  keychain.clear()
  vi.clearAllMocks()
})

// 2026-10-23: no pnpm dev, ler ou guardar a chave pelo cofre fazia o macOS pedir a senha das Chaves
// para o "Argus Safe Storage" a cada versão nova do Electron (o de desenvolvimento muda de assinatura).
describe('chaves de API no pnpm dev', () => {
  it('guarda em texto, só com permissão do dono, sem perguntar ao cofre', () => {
    packaged(false)
    saveKey('gemini', ACCOUNT, 'AIza-dev')
    const file = join(dir(), 'argus-key.txt')
    expect(readFileSync(file, 'utf8')).toBe('AIza-dev')
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-dev')
    expect(vault.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(vault.encryptString).not.toHaveBeenCalled()
  })

  it('a cifrada de antes fica de fora (abrir pediria a senha), e a chave nova a substitui', () => {
    packaged(false)
    mkdirSync(dir(), { recursive: true })
    writeFileSync(join(dir(), 'argus-key.bin'), 'cifrado:antiga')
    expect(readKey('gemini', ACCOUNT)).toBeNull()
    expect(vault.decryptString).not.toHaveBeenCalled()
    saveKey('gemini', ACCOUNT, 'AIza-nova')
    expect(existsSync(join(dir(), 'argus-key.bin'))).toBe(false)
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-nova')
  })
})

describe('chaves de API no app instalado', () => {
  it('Windows e Linux: continua no cofre do sistema', () => {
    asPlatform('linux')
    packaged(true)
    saveKey('gemini', ACCOUNT, 'AIza-app')
    expect(readFileSync(join(dir(), 'argus-key.bin'), 'utf8')).toBe('cifrado:AIza-app')
    expect(existsSync(join(dir(), 'argus-key.txt'))).toBe(false)
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-app')
    expect(vault.decryptString).toHaveBeenCalled()
  })
})

// 2026-11-13: no Mac, o safeStorage pedia a senha das Chaves a cada versão nova do Argus (o certificado
// autoassinado faz o macOS prender a permissão ao binário de cada build).
describe('chaves de API no app instalado do Mac', () => {
  it('vai para as Chaves pelo `security`, sem tocar no safeStorage nem deixar arquivo', () => {
    asPlatform('darwin')
    packaged(true)
    saveKey('gemini', ACCOUNT, 'AIza-mac')
    expect(keychain.get(`key-gemini-${ACCOUNT}`)).toBe('AIza-mac')
    expect(existsSync(join(dir(), 'argus-key.bin'))).toBe(false)
    expect(existsSync(join(dir(), 'argus-key.txt'))).toBe(false)
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-mac')
    expect(vault.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(vault.encryptString).not.toHaveBeenCalled()
    expect(vault.decryptString).not.toHaveBeenCalled()
  })

  it('a cifrada pelo safeStorage é lida uma última vez, passa para as Chaves e some', () => {
    asPlatform('darwin')
    packaged(true)
    mkdirSync(dir(), { recursive: true })
    writeFileSync(join(dir(), 'argus-key.bin'), 'cifrado:AIza-antiga')
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-antiga')
    expect(keychain.get(`key-gemini-${ACCOUNT}`)).toBe('AIza-antiga')
    expect(existsSync(join(dir(), 'argus-key.bin'))).toBe(false)
    expect(readKey('gemini', ACCOUNT)).toBe('AIza-antiga')
    expect(vault.decryptString).toHaveBeenCalledTimes(1)
  })

  it('a conta apagada tira a chave das Chaves', () => {
    asPlatform('darwin')
    packaged(true)
    saveKey('gemini', ACCOUNT, 'AIza-mac')
    deleteKey('gemini', ACCOUNT)
    expect(keychain.has(`key-gemini-${ACCOUNT}`)).toBe(false)
  })
})
