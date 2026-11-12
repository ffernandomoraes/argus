import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { errorMessage } from '../lib/errors'

// O que o acesso remoto guarda: a sala deste computador na ponte (id e chave), os aparelhos
// pareados com ele e os computadores que ele pode abrir. Tem segredos (as chaves de cada aparelho),
// então vai cifrado pelo cofre do sistema no app instalado. No pnpm dev, sem o cofre (ver
// providers/keys.ts e a pergunta das Chaves a cada Electron novo): texto só com permissão do dono.

export type PairedDevice = { id: string; name: string; psk: string; pairedAt: number; lastSeen?: number }
export type KnownHost = { hostId: string; name: string; deviceId: string; psk: string; pairedAt: number }

export type RemoteStore = {
  // Este computador aceita conexões de aparelhos pareados.
  hosting: boolean
  hostId: string
  hostKey: string
  devices: PairedDevice[]
  hosts: KnownHost[]
}

const SEALED = 'remote-access.bin'
const PLAIN = 'remote-access.json'

// No Linux sem chaveiro o Electron diz que cifra, mas usa uma senha fixa ('basic_text'): conta como
// sem cofre (o arquivo não pareceria protegido sem estar).
const vault = () =>
  app.isPackaged && safeStorage.isEncryptionAvailable() && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
const path = (name: string) => join(app.getPath('userData'), name)

const randomId = (bytes: number) => randomBytes(bytes).toString('base64url')

function fresh(): RemoteStore {
  return { hosting: false, hostId: randomId(24), hostKey: randomId(32), devices: [], hosts: [] }
}

function parse(text: string): RemoteStore {
  const raw = JSON.parse(text) as Partial<RemoteStore>
  const base = fresh()
  return {
    hosting: raw.hosting === true,
    hostId: typeof raw.hostId === 'string' && raw.hostId ? raw.hostId : base.hostId,
    hostKey: typeof raw.hostKey === 'string' && raw.hostKey ? raw.hostKey : base.hostKey,
    devices: Array.isArray(raw.devices) ? raw.devices.filter((d) => d && typeof d.id === 'string' && typeof d.psk === 'string') : [],
    hosts: Array.isArray(raw.hosts) ? raw.hosts.filter((h) => h && typeof h.hostId === 'string' && typeof h.psk === 'string') : []
  }
}

export function loadRemoteStore(): RemoteStore {
  try {
    if (vault() && existsSync(path(SEALED))) return parse(safeStorage.decryptString(readFileSync(path(SEALED))))
    if (existsSync(path(PLAIN))) return parse(readFileSync(path(PLAIN), 'utf8'))
  } catch (err) {
    // Ilegível (cofre trocado, arquivo estragado): fica guardado à parte, em vez de a próxima gravação
    // apagar os pareamentos de vez.
    console.error('[remoto] não deu para ler os pareamentos:', errorMessage(err))
    for (const name of [SEALED, PLAIN]) {
      try {
        if (existsSync(path(name))) renameSync(path(name), path(`${name}.unreadable-${Date.now()}`))
      } catch {
        // segue com os pareamentos vazios
      }
    }
  }
  return fresh()
}

export function saveRemoteStore(store: RemoteStore): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const text = JSON.stringify(store, null, 2)
  if (vault()) {
    writeFileSync(path(SEALED), safeStorage.encryptString(text), { mode: 0o600 })
    rmSync(path(PLAIN), { force: true })
  } else {
    writeFileSync(path(PLAIN), text, { mode: 0o600 })
  }
}

export const newDeviceId = () => randomId(16)
