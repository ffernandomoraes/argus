import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';
import { keychainDelete, keychainRead, keychainWrite } from '../lib/macKeychain';

// O token da sessão da conta do Argus. Onde fica, como as chaves dos agentes (providers/keys.ts):
// - app instalado no Mac: nas Chaves, pelo `security` (sem pedir senha a cada versão);
// - app instalado no Windows e no Linux: cifrado pelo cofre do sistema, na pasta de dados;
// - pnpm dev e Linux sem chaveiro: texto, só com permissão do dono (o dev não usa o cofre).

const KEYCHAIN_ACCOUNT = 'argus-account-session';
const SEALED = 'argus-account-session.bin';
const PLAIN = 'argus-account-session.txt';

const macKeychain = () => app.isPackaged && process.platform === 'darwin';
const vault = () =>
  app.isPackaged &&
  process.platform !== 'darwin' &&
  safeStorage.isEncryptionAvailable() &&
  !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text');
const path = (name: string) => join(app.getPath('userData'), name);

export function saveSessionToken(token: string): void {
  if (macKeychain()) {
    keychainWrite(KEYCHAIN_ACCOUNT, token);
  } else if (vault()) {
    writeFileSync(path(SEALED), safeStorage.encryptString(token), { mode: 0o600 });
    rmSync(path(PLAIN), { force: true });
  } else {
    writeFileSync(path(PLAIN), token, { mode: 0o600 });
    rmSync(path(SEALED), { force: true });
  }
}

export function readSessionToken(): string | null {
  try {
    if (macKeychain()) return keychainRead(KEYCHAIN_ACCOUNT);
    if (vault() && existsSync(path(SEALED))) return safeStorage.decryptString(readFileSync(path(SEALED)));
    return existsSync(path(PLAIN)) ? readFileSync(path(PLAIN), 'utf8').trim() || null : null;
  } catch (err) {
    console.warn('[account] não deu para ler a sessão:', err);
    return null;
  }
}

export function deleteSessionToken(): void {
  try {
    if (macKeychain()) keychainDelete(KEYCHAIN_ACCOUNT);
  } catch (err) {
    console.warn('[account] não deu para apagar a sessão das Chaves:', err);
  }
  rmSync(path(SEALED), { force: true });
  rmSync(path(PLAIN), { force: true });
}
