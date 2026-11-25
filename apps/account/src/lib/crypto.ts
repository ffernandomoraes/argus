import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Sorteio, hash e comparação para o código de uso único do login do app (ver modules/desktop), e a
// cifra do que fica guardado e não pode vazar junto com o banco (ver modules/github).

// 32 bytes viram 43 letras em base64 de URL.
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('base64url');

// Comparação sem atalho: o tempo da resposta não diz quantas letras estavam certas.
export function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Cifra (AES-256-GCM) com uma chave tirada do segredo do servidor, uma por finalidade: quem copiar só
// o banco não lê o que foi guardado. Trocar o segredo torna ilegível o que já estava guardado.
export type Sealer = { seal(text: string): string; open(sealed: string): string | null };

export function createSealer(secret: string, purpose: string): Sealer {
  const key = Buffer.from(hkdfSync('sha256', secret, 'argus-account', purpose, 32));
  return {
    seal(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return ['v1', iv, body, cipher.getAuthTag()].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
    },
    open(sealed) {
      const [version, iv, body, tag] = sealed.split('.');
      if (version !== 'v1' || !iv || !body || !tag) return null;
      const ivBytes = Buffer.from(iv, 'base64url');
      const tagBytes = Buffer.from(tag, 'base64url');
      // Etiqueta inteira (16 bytes): uma curta seria mais fácil de forjar.
      if (ivBytes.length !== 12 || tagBytes.length !== 16) return null;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, ivBytes, { authTagLength: 16 });
        decipher.setAuthTag(tagBytes);
        return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
