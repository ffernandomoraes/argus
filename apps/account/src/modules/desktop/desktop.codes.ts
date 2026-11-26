import { eq, lt } from 'drizzle-orm';

import type { Database } from '../../db/client';
import { randomToken, sameText, sha256 } from '../../lib/crypto';
import { desktopLoginCode } from './desktop.table';

// O código de uso único entre o fim do login no navegador e o app do computador. O app sorteia um
// segredo (verifier) e manda só o hash dele (challenge) no começo; o código só vira sessão para quem
// mostra o segredo. Um link de login mandado por outra pessoa não loga no Argus dela: a volta cai no
// computador de quem clicou (127.0.0.1), e o código não vale sem o segredo do app que começou.

const CODE_MINUTES = 5;
// web: o app do celular (no navegador).
const PLATFORMS = new Set(['darwin', 'win32', 'linux', 'web']);

// sha256 em base64 de URL: 43 letras.
export const isChallenge = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const isVerifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
export const isCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

// A porta em que o app espera a volta, neste computador. Nulo: não é uma porta de app.
export function parsePort(value: unknown): number | null {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
}

export type Lang = 'pt' | 'en';
export const parseLang = (value: unknown): Lang => (value === 'pt' ? 'pt' : 'en');

export async function createLoginCode(db: Database, userId: string, challenge: string, now = new Date()): Promise<string> {
  const code = randomToken();
  // Os vencidos de todo mundo saem junto: a tabela não cresce.
  await db.delete(desktopLoginCode).where(lt(desktopLoginCode.expiresAt, now));
  await db.insert(desktopLoginCode).values({
    codeHash: sha256(code),
    challenge,
    userId,
    expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000),
  });
  return code;
}

// O dono do código, se o segredo bate com o challenge e o código está no prazo. Usado uma vez só:
// sai do banco na primeira tentativa, certa ou errada.
export async function redeemLoginCode(db: Database, code: string, verifier: string, now = new Date()): Promise<string | null> {
  const [row] = await db.delete(desktopLoginCode).where(eq(desktopLoginCode.codeHash, sha256(code))).returning();
  if (!row || row.expiresAt < now) return null;
  return sameText(sha256(verifier), row.challenge) ? row.userId : null;
}

// Nome do aparelho como o app manda (o nome do computador), sem caracteres de controle.
export function cleanDevice(raw: unknown): { name: string; platform: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { name?: unknown; platform?: unknown };
  const name = typeof r.name === 'string' ? r.name.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 64) : '';
  const platform = typeof r.platform === 'string' && PLATFORMS.has(r.platform) ? r.platform : 'other';
  return { name: name || 'Argus', platform };
}

// Login do app do celular instalado (iPhone, Android): o navegador não consegue devolver o código ao
// app, então o app pergunta, com o segredo, se o login do challenge dele já terminou. O código do
// banco fica sem uso aqui: vale o challenge. 'pending': ainda não terminou (ou nunca começou).
export async function redeemWaitingLogin(db: Database, verifier: string, now = new Date()): Promise<string | 'pending' | null> {
  const rows = await db.delete(desktopLoginCode).where(eq(desktopLoginCode.challenge, sha256(verifier))).returning();
  if (!rows.length) return 'pending';
  const valid = rows.find((r) => r.expiresAt >= now);
  return valid ? valid.userId : null;
}

// O código curto que o app do celular mostra enquanto espera e a página do navegador repete antes de
// confirmar: quem recebeu um link de login de outra pessoa vê que não bate com nada na tela dele.
// Repetido em apps/mobile/src/net/loginWait.ts (tem que dar o mesmo).
const CONFIRM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function confirmCodeOf(challenge: string): string {
  const n = Buffer.from(challenge, 'base64url').readUInt32BE(0);
  let code = '';
  for (let i = 0; i < 6; i++) code += CONFIRM_ALPHABET[(n >>> (i * 5)) & 31];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
