import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRemoteStore, saveRemoteStore } from './store'

// As Chaves de mentira (o `security` de verdade não roda nos testes).
const keychain = vi.hoisted(() => new Map<string, string>())
vi.mock('../lib/macKeychain', () => ({
  keychainRead: vi.fn((account: string) => keychain.get(account) ?? null),
  keychainWrite: vi.fn((account: string, secret: string) => void keychain.set(account, secret)),
  keychainDelete: vi.fn((account: string) => void keychain.delete(account))
}))

const vault = {
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
  encryptString: vi.fn((text: string) => Buffer.from(`cifrado:${text}`)),
  decryptString: vi.fn((data: Buffer) => data.toString().replace(/^cifrado:/, ''))
}
const real = { isPackaged: app.isPackaged, ...safeStorage }
const realPlatform = process.platform
const file = (name: string) => join(app.getPath('userData'), name)

function installedOn(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform })
  Object.assign(app, { isPackaged: true })
  Object.assign(safeStorage, vault)
}

afterEach(() => {
  for (const name of ['remote-access.bin', 'remote-access.enc', 'remote-access.json']) rmSync(file(name), { force: true })
  Object.defineProperty(process, 'platform', { value: realPlatform })
  Object.assign(app, { isPackaged: real.isPackaged })
  Object.assign(safeStorage, { isEncryptionAvailable: real.isEncryptionAvailable })
  keychain.clear()
  vi.clearAllMocks()
})

// 2026-11-13: no Mac, o safeStorage pedia a senha das Chaves a cada versão nova do Argus.
describe('pareamentos no app instalado do Mac', () => {
  it('cifrados em arquivo, com só a chave nas Chaves, sem tocar no safeStorage', () => {
    installedOn('darwin')
    const store = { ...loadRemoteStore(), hosting: true }
    saveRemoteStore(store)
    expect(readFileSync(file('remote-access.enc')).includes(store.hostKey)).toBe(false)
    expect(Buffer.from(keychain.get('remote-access-key')!, 'base64')).toHaveLength(32)
    expect(loadRemoteStore()).toEqual(store)
    expect(vault.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(vault.decryptString).not.toHaveBeenCalled()
  })

  it('o arquivo do safeStorage é lido uma última vez e trocado', () => {
    installedOn('darwin')
    const old = { ...loadRemoteStore(), hosting: true }
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file('remote-access.bin'), `cifrado:${JSON.stringify(old)}`)
    expect(loadRemoteStore()).toEqual(old)
    expect(existsSync(file('remote-access.bin'))).toBe(false)
    expect(loadRemoteStore()).toEqual(old)
    expect(vault.decryptString).toHaveBeenCalledTimes(1)
  })
})

describe('pareamentos no app instalado do Windows e do Linux', () => {
  it('continuam no cofre do sistema', () => {
    installedOn('linux')
    const store = { ...loadRemoteStore(), hosting: true }
    saveRemoteStore(store)
    expect(readFileSync(file('remote-access.bin'), 'utf8').startsWith('cifrado:')).toBe(true)
    expect(loadRemoteStore()).toEqual(store)
    expect(keychain.size).toBe(0)
  })
})
