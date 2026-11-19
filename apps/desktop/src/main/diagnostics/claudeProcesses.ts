import type { ChildProcess } from 'node:child_process';
import { scrubText } from '../errorReports/scrub';
import { note } from './journal';

// Os `claude` que o Argus abre fora das conversas (uso, renovação do login, conferência do login): para
// que cada um foi aberto, de qual conta, quanto durou, como saiu e o que escreveu no erro. Antes, o
// rastro do Sentry dizia só "saiu com código 1" (ARGUS-K, 2026-11-18: não dava para saber se era a
// leitura de uso nem por que o login caiu). As conversas o SDK abre sozinho: entram pela contagem
// das conversas abertas da conta (setChatCounter).

export type ClaudeRole = 'usage' | 'usageOnce' | 'renew' | 'authStatus';

const ROLE_LABELS: Record<ClaudeRole, string> = {
  usage: 'uso (o que fica aberto)',
  usageOnce: 'uso (de uma vez só)',
  renew: 'renovação do login',
  authStatus: 'conferência do login',
};

const STDERR_KEEP = 2000;
const STDERR_SHOWN = 300;
const FAILURES_KEPT = 30;

export type ClaudeFailure = { account: string; role: ClaudeRole; at: number; ms: number; exit: string; stderr: string };

let seq = 0;
const running = new Map<number, { account: string; role: ClaudeRole }>();
const failures: ClaudeFailure[] = [];
let chatCount: (account: string) => number = () => 0;

// As conversas abertas da conta (ver src/main/index.ts).
export function setChatCounter(count: (account: string) => number): void {
  chatCount = count;
}

// A última linha que diz alguma coisa (o Claude Code costuma terminar com a pilha do erro, e a
// mensagem vem antes dela).
function lastMessage(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^at\s/.test(l));
  return scrubText(lines.at(-1) ?? '', STDERR_SHOWN);
}

export function trackClaude(proc: ChildProcess, account: string, role: ClaudeRole): void {
  const id = ++seq;
  const startedAt = Date.now();
  running.set(id, { account, role });
  let stderr = '';
  proc.stderr?.on('data', (d: Buffer | string) => {
    stderr = (stderr + d.toString()).slice(-STDERR_KEEP);
  });
  // A conferência do login roda a cada abertura e em cada nova tentativa: só entra no diário quando falha.
  if (role !== 'authStatus') note('claude', `abriu: ${ROLE_LABELS[role]}`, { account, pid: proc.pid });
  let done = false;
  const finish = (exit: string, ok: boolean) => {
    if (done) return;
    done = true;
    running.delete(id);
    const ms = Date.now() - startedAt;
    if (ok) {
      if (role !== 'authStatus') note('claude', `fechou: ${ROLE_LABELS[role]}`, { account, ms });
      return;
    }
    const failure = { account, role, at: Date.now(), ms, exit, stderr: lastMessage(stderr) };
    failures.push(failure);
    if (failures.length > FAILURES_KEPT) failures.shift();
    note('claude', `${ROLE_LABELS[role]} saiu com ${exit}`, { account, ms, stderr: failure.stderr || null });
  };
  proc.once('close', (code: number | null, signal: NodeJS.Signals | null) => finish(signal ?? String(code), code === 0));
  proc.once('error', (err: Error) => finish(`erro ao abrir (${err.message})`, false));
}

// Os `claude` do Argus abertos agora para a conta: os de fora das conversas e as conversas.
export function argusClaudes(account: string): number {
  let count = 0;
  for (const p of running.values()) if (p.account === account) count++;
  return count + chatCount(account);
}

// A última falha de um `claude` da conta nos últimos `withinMs`.
export function lastClaudeFailure(account: string, withinMs: number, now = Date.now()): ClaudeFailure | null {
  for (let i = failures.length - 1; i >= 0; i--) {
    const f = failures[i];
    if (now - f.at > withinMs) return null;
    if (f.account === account) return f;
  }
  return null;
}

// Para os testes.
export function clearClaudeProcesses(): void {
  running.clear();
  failures.length = 0;
  chatCount = () => 0;
}
