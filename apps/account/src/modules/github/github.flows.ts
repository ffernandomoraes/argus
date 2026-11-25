import { randomToken, sameText, sha256 } from '../../lib/crypto';
import type { Lang } from '../desktop/desktop.codes';
import type { GitHubTokens } from './github.client';

// Conectar o GitHub, do mesmo jeito que o login do app (ver desktop.codes.ts): o app sorteia um
// segredo e manda o hash dele; o navegador passa pelo GitHub e volta ao app (127.0.0.1) com um código
// de uso único; o código só vira conexão para quem mostra o segredo, e vai para a conta de quem
// mostrou (a sessão do pedido), nunca para a de quem mandou o link. Fica na memória: o servidor é
// uma instância só, e um reinício no meio só faz a pessoa clicar de novo.

const FLOW_MINUTES = 10;
const CODE_MINUTES = 5;
// Teto para ninguém encher a memória abrindo conexões sem terminar.
const MAX_PENDING = 2000;

export type FlowStart = { port: number; challenge: string; lang: Lang };
export type Connected = { tokens: GitHubTokens; githubId: string; login: string };

type Timed<T> = T & { expiresAt: number };

// Guarda até `expiresAt`, tirando os vencidos (e o mais antigo, no teto).
function put<T>(map: Map<string, Timed<T>>, key: string, value: Timed<T>): void {
  const now = Date.now();
  for (const [k, v] of map) if (v.expiresAt < now) map.delete(k);
  if (map.size >= MAX_PENDING) map.delete(map.keys().next().value!);
  map.set(key, value);
}

function take<T>(map: Map<string, Timed<T>>, key: string, now: number): T | null {
  const v = map.get(key);
  map.delete(key);
  return v && v.expiresAt >= now ? v : null;
}

export class GitHubFlows {
  private readonly starts = new Map<string, Timed<FlowStart>>();
  private readonly codes = new Map<string, Timed<Connected & { challenge: string }>>();

  // O `state` que vai ao GitHub e volta no callback.
  start(flow: FlowStart, now = Date.now()): string {
    const state = randomToken();
    put(this.starts, state, { ...flow, expiresAt: now + FLOW_MINUTES * 60_000 });
    return state;
  }

  finish(state: string, now = Date.now()): FlowStart | null {
    return take(this.starts, state, now);
  }

  // O código que volta ao app.
  createCode(challenge: string, connected: Connected, now = Date.now()): string {
    const code = randomToken();
    put(this.codes, sha256(code), { ...connected, challenge, expiresAt: now + CODE_MINUTES * 60_000 });
    return code;
  }

  // Usado uma vez só, certo ou errado.
  redeem(code: string, verifier: string, now = Date.now()): Connected | null {
    const found = take(this.codes, sha256(code), now);
    return found && sameText(sha256(verifier), found.challenge) ? { tokens: found.tokens, githubId: found.githubId, login: found.login } : null;
  }
}

export const githubFlows = new GitHubFlows();
