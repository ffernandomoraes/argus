import type { ClaudeAccount } from './auth';

// O uso do login de uma conta dentro de uma distro do WSL (Argus no Windows com o claude.exe): as
// conversas das pastas de lá gastam o limite do login de lá, que pode ser de outra conta do Claude.
// Quando é, esse uso ganha uma linha própria na barra e no painel (relato de 2026-11-12: a conta
// aparecia em 0% enquanto as conversas do WSL gastavam o limite de outra).

// A chave desse uso, ao lado das outras ("main", "codex:main").
export const wslUsageKey = (distro: string, account: string): string => `wsl:${distro.toLowerCase()}:${account}`;

export type WslUsageLogin = {
  key: string
  account: string
  distro: string
  // Ausente: ainda sem como decidir (o login da conta, ou o de lá, ainda não foi conferido).
  email?: string
};

export type WslUsage = {
  // Logins de lá com uso próprio: de uma conta do Claude que nenhuma conta do app tem no Windows.
  logins: WslUsageLogin[]
  // Logins de lá que são de outra conta do app (from): o uso já aparece nela.
  borrowed: { account: string; distro: string; from: string }[]
};

const same = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// Mesma regra para o processo principal (que monitores abrir) e para a tela (que linhas mostrar).
// Login de lá igual ao da própria conta no Windows: o uso é o mesmo, nada a mais. Igual ao de outra
// conta do app: aparece nela (borrowed). O mesmo login em duas contas ou distros: uma linha só.
export function wslUsage(accounts: Pick<ClaudeAccount, 'id' | 'status' | 'wsl'>[]): WslUsage {
  const logins: WslUsageLogin[] = [];
  const borrowed: WslUsage['borrowed'] = [];
  for (const a of accounts) {
    for (const w of a.wsl ?? []) {
      const key = wslUsageKey(w.distro, a.id);
      if (!w.status || !a.status) {
        logins.push({ key, account: a.id, distro: w.distro });
        continue;
      }
      const email = w.status.loggedIn ? w.status.email : undefined;
      if (!email) continue;
      const owner = accounts.find((o) => o.status?.loggedIn && same(o.status.email, email));
      if (owner) {
        if (owner.id !== a.id) borrowed.push({ account: a.id, distro: w.distro, from: owner.id });
        continue;
      }
      if (!logins.some((l) => same(l.email, email))) logins.push({ key, account: a.id, distro: w.distro, email });
    }
  }
  return { logins, borrowed };
}
