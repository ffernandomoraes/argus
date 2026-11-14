import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';
import { errorMessage } from '../lib/errors';
import { keychainRead, keychainWrite } from '../lib/macKeychain';
import type { DeviceKind, WebPushSubscription } from '@argus/shared/webRemote';
import { newPushKeys, type PushKeys } from './push';

// O que o acesso remoto guarda: a sala deste computador na ponte (id e chave), os aparelhos
// pareados com ele e os computadores que ele pode abrir. Tem segredos (as chaves de cada aparelho),
// então vai cifrado no app instalado:
// - Mac: AES-256-GCM, com a chave nas Chaves pelo `security` (ver lib/macKeychain.ts). O safeStorage
//   pedia a senha das Chaves a cada versão nova (2026-11-13); o arquivo dele (remote-access.bin) é lido
//   uma última vez e trocado. Nas Chaves vai só a chave: o `security` não aceita segredo grande.
// - Windows e Linux: pelo cofre do sistema (safeStorage).
// No pnpm dev, sem cofre (ver providers/keys.ts e a pergunta das Chaves a cada Electron novo): texto
// só com permissão do dono.

// kind: outro Argus ou o navegador do celular (sem ele: Argus, os pareados antes do celular).
// push: inscrição das notificações do navegador.
export type PairedDevice = {
  id: string
  name: string
  psk: string
  pairedAt: number
  lastSeen?: number
  kind?: DeviceKind
  push?: WebPushSubscription
};
export type KnownHost = { hostId: string; name: string; deviceId: string; psk: string; pairedAt: number };

export type RemoteStore = {
  // Este computador aceita conexões de aparelhos pareados.
  hosting: boolean
  // Com o acesso remoto ligado, o sistema não dorme (a tela pode apagar): dormindo, a ligação com a
  // ponte cai e ninguém de longe consegue acordá-lo.
  keepAwake: boolean
  hostId: string
  hostKey: string
  devices: PairedDevice[]
  hosts: KnownHost[]
  // Chaves com que este computador assina as notificações do celular (ver push.ts).
  pushKeys: PushKeys
};

const SEALED = 'remote-access.bin';
const ENCRYPTED = 'remote-access.enc';
const PLAIN = 'remote-access.json';
const KEYCHAIN_ACCOUNT = 'remote-access-key';

const macKeychain = () => app.isPackaged && process.platform === 'darwin';
// No Linux sem chaveiro o Electron diz que cifra, mas usa uma senha fixa ('basic_text'): conta como
// sem cofre (o arquivo não pareceria protegido sem estar). No Mac nem pergunta: a pergunta já lê as
// Chaves.
const vault = () =>
  app.isPackaged &&
  process.platform !== 'darwin' &&
  safeStorage.isEncryptionAvailable() &&
  !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text');

// Os pareamentos existem mas não dá para ler agora (as Chaves sem responder, o chaveiro do Linux
// ainda trancado logo depois de ligar): os arquivos ficam como estão e a leitura é tentada de novo.
// Antes isso virava pareamentos vazios com o acesso desligado, e quem estava longe ficava de fora
// até parear de novo em casa (2026-11-14).
export class StoreUnavailable extends Error {}
const path = (name: string) => join(app.getPath('userData'), name);

// Arquivo: iv (12 bytes) + etiqueta (16) + cifrado.
function encrypt(text: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

function decrypt(file: Buffer, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, file.subarray(0, 12));
  decipher.setAuthTag(file.subarray(12, 28));
  return Buffer.concat([decipher.update(file.subarray(28)), decipher.final()]).toString('utf8');
}

function fileKey(create: boolean): Buffer | null {
  let stored: string | null;
  try {
    stored = keychainRead(KEYCHAIN_ACCOUNT);
  } catch (err) {
    throw new StoreUnavailable(`as Chaves não responderam: ${errorMessage(err)}`);
  }
  if (stored) return Buffer.from(stored, 'base64');
  if (!create) return null;
  const key = randomBytes(32);
  keychainWrite(KEYCHAIN_ACCOUNT, key.toString('base64'));
  return key;
}

const randomId = (bytes: number) => randomBytes(bytes).toString('base64url');

export function freshRemoteStore(): RemoteStore {
  return { hosting: false, keepAwake: true, hostId: randomId(24), hostKey: randomId(32), devices: [], hosts: [], pushKeys: newPushKeys() };
}

function parse(text: string): RemoteStore {
  const raw = JSON.parse(text) as Partial<RemoteStore>;
  const base = freshRemoteStore();
  return {
    hosting: raw.hosting === true,
    keepAwake: raw.keepAwake !== false,
    hostId: typeof raw.hostId === 'string' && raw.hostId ? raw.hostId : base.hostId,
    hostKey: typeof raw.hostKey === 'string' && raw.hostKey ? raw.hostKey : base.hostKey,
    devices: Array.isArray(raw.devices) ? raw.devices.filter((d) => d && typeof d.id === 'string' && typeof d.psk === 'string') : [],
    hosts: Array.isArray(raw.hosts) ? raw.hosts.filter((h) => h && typeof h.hostId === 'string' && typeof h.psk === 'string') : [],
    pushKeys:
      raw.pushKeys && typeof raw.pushKeys.publicKey === 'string' && typeof raw.pushKeys.privateKey === 'string' ? raw.pushKeys : base.pushKeys,
  };
}

export function loadRemoteStore(): RemoteStore {
  try {
    if (macKeychain()) {
      if (existsSync(path(ENCRYPTED))) {
        const key = fileKey(false);
        if (!key) throw new Error('a chave dos pareamentos não está nas Chaves');
        return parse(decrypt(readFileSync(path(ENCRYPTED)), key));
      }
      // Guardado pelo safeStorage numa versão anterior: a última vez que pede a senha das Chaves.
      if (existsSync(path(SEALED))) {
        const store = parse(safeStorage.decryptString(readFileSync(path(SEALED))));
        try {
          saveRemoteStore(store);
        } catch (err) {
          console.error('[remoto] não deu para passar os pareamentos para as Chaves:', errorMessage(err));
        }
        return store;
      }
    } else if (app.isPackaged && existsSync(path(SEALED))) {
      if (!safeStorage.isEncryptionAvailable()) throw new StoreUnavailable('o cofre do sistema ainda não está disponível');
      if (vault()) return parse(safeStorage.decryptString(readFileSync(path(SEALED))));
    }
    if (existsSync(path(PLAIN))) return parse(readFileSync(path(PLAIN), 'utf8'));
  } catch (err) {
    if (err instanceof StoreUnavailable) throw err;
    // Ilegível (cofre trocado, arquivo estragado): fica guardado à parte, em vez de a próxima gravação
    // apagar os pareamentos de vez.
    console.error('[remoto] não deu para ler os pareamentos:', errorMessage(err));
    for (const name of [SEALED, ENCRYPTED, PLAIN]) {
      try {
        if (existsSync(path(name))) renameSync(path(name), path(`${name}.unreadable-${Date.now()}`));
      } catch {
        // segue com os pareamentos vazios
      }
    }
  }
  return freshRemoteStore();
}

// Grava num arquivo ao lado e troca de uma vez: faltando luz no meio, fica o arquivo inteiro de antes
// (gravado direto, ficava pela metade, ilegível, e os pareamentos se perdiam).
function writeWhole(name: string, data: string | Buffer): void {
  const temp = path(`${name}.tmp`);
  writeFileSync(temp, data, { mode: 0o600 });
  renameSync(temp, path(name));
}

export function saveRemoteStore(store: RemoteStore): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  const text = JSON.stringify(store, null, 2);
  if (macKeychain()) {
    writeWhole(ENCRYPTED, encrypt(text, fileKey(true)!));
    rmSync(path(SEALED), { force: true });
    rmSync(path(PLAIN), { force: true });
  } else if (vault()) {
    writeWhole(SEALED, safeStorage.encryptString(text));
    rmSync(path(PLAIN), { force: true });
  } else {
    writeWhole(PLAIN, text);
  }
}

export const newDeviceId = () => randomId(16);
