import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import type { ProviderInstall } from '@argus/shared/providers';
import { note } from '../diagnostics/journal';
import { reportWarning } from '../errorReports';
import { scrubText } from '../errorReports/scrub';
import { tr } from '../i18n';
import { errorMessage } from '../lib/errors';
import { findCommand } from './bins';
import { AGY_MIN_VERSION, missingAcp, outdatedMessage } from './antigravityOutdated';
import { RpcError } from './rpc';

export { outdatedMessage } from './antigravityOutdated';

// O que pode dar errado antes e durante o login do Antigravity, e o que vai para o diário e o Sentry
// quando dá: sem isso, a tela só dizia "não terminou" e não havia como saber o motivo (2026-11-19).

export const UPDATE_COMMAND = 'agy update';

// "1.4.12" mais nova que "1.5.0"? Compara número a número.
export function olderThan(version: string, min: string): boolean {
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) < b[i];
  }
  return false;
}

// Versão do agy instalado ("1.5.12"); nulo se ele não respondeu.
export function agyVersion(): Promise<string | null> {
  const cmd = findCommand('antigravity');
  if (!cmd) return Promise.resolve(null);
  return new Promise((resolve) =>
    execFile(cmd.file, [...cmd.args, '--version'], { cwd: homedir(), timeout: 15_000, windowsHide: true, encoding: 'utf8' }, (err, stdout) =>
      resolve(/\d+\.\d+\.\d+/.exec(stdout)?.[0] ?? null),
    ),
  );
}

// Instalação conferida: com o agy antigo, o Argus pede para atualizar em vez de deixar conectar.
export async function antigravityInstall(): Promise<Partial<ProviderInstall>> {
  const version = await agyVersion();
  if (!version || !olderThan(version, AGY_MIN_VERSION)) return { version: version ?? undefined };
  note('login', 'antigravity: agy antigo', { version });
  return { status: 'outdated', version, command: UPDATE_COMMAND };
}

export type SignInFailure = { reason: 'timeout' | 'no_answer' | 'exited' | 'refused' | 'outdated' | 'other'; message: string; detail: string };

// Erro do login → o motivo, em português, para a tela; `detail` é o texto do agy.
export function signInFailure(err: unknown): SignInFailure {
  const detail = err instanceof RpcError ? ((err.data as { message?: string } | undefined)?.message ?? err.message) : errorMessage(err);
  if (missingAcp(detail)) return { reason: 'outdated', detail, message: outdatedMessage() };
  if (/sem resposta para authenticate/.test(detail))
    return {
      reason: 'timeout',
      detail,
      message: tr(
        'O login não terminou em 10 minutos. Tente de novo e conclua na página da Google que abrir no navegador.',
        'Sign-in didn’t finish within 10 minutes. Try again and complete it on the Google page that opens in your browser.',
      ),
    };
  if (/sem resposta para initialize/.test(detail))
    return { reason: 'no_answer', detail, message: tr('O Antigravity CLI não respondeu ao abrir. Tente de novo.', 'Antigravity CLI didn’t respond when opening. Try again.') };
  if (err instanceof RpcError && err.code !== undefined)
    return { reason: 'refused', detail, message: tr(`A Google recusou o login: ${detail}`, `Google refused the sign-in: ${detail}`) };
  if (err instanceof RpcError)
    return { reason: 'exited', detail, message: tr(`O Antigravity CLI fechou durante o login: ${detail}`, `Antigravity CLI closed during sign-in: ${detail}`) };
  return { reason: 'other', detail, message: detail || tr('O login do Antigravity não terminou.', 'Antigravity sign-in didn’t finish.') };
}

// Falha do login: no diário e no Sentry, com o que separa uma causa da outra. Devolve o texto da tela.
export function reportSignInFailure(failure: SignInFailure, startedAt: number): string {
  const data = { reason: failure.reason, detail: scrubText(failure.detail, 300), seconds: Math.round((Date.now() - startedAt) / 1000) };
  void agyVersion().then((version) => {
    note('login', 'antigravity: login falhou', { ...data, agyVersion: version ?? 'sem resposta' });
    reportWarning('Login do Antigravity falhou', { ...data, agyVersion: version ?? 'sem resposta' });
  });
  return failure.message;
}
