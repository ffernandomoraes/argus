import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { probeScript } from './distros';

// O script que pergunta à distro o que o app precisa dela, rodado de verdade num `sh` (fora do
// Windows), com um `wslpath` falso no PATH: sem um Windows com WSL para testar, é aqui que um erro
// de sintaxe ou de aspas aparece.

const root = mkdtempSync(join(tmpdir(), 'argus-probe-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Pasta do Windows "montada" na distro, com espaço e aspas no nome.
const mounted = join(root, 'win home', "Jo'ao");
const bin = join(root, 'bin');
mkdirSync(mounted, { recursive: true });
mkdirSync(bin);

function run(script: string, wslpath: string | null): string {
  if (wslpath !== null) {
    writeFileSync(join(bin, 'wslpath'), `#!/bin/sh\n${wslpath}\n`);
    chmodSync(join(bin, 'wslpath'), 0o755);
  } else rmSync(join(bin, 'wslpath'), { force: true });
  // Pasta do usuário vazia: o shell de login não carrega o perfil de quem roda o teste.
  return execFileSync('sh', ['-s'], { input: script, encoding: 'utf8', timeout: 20_000, env: { PATH: `${bin}${delimiter}/usr/bin${delimiter}/bin`, HOME: root } });
}
const field = (out: string, mark: string) => out.split('\n').find((l) => l.startsWith(mark))?.slice(mark.length);

describe.skipIf(process.platform === 'win32')('probeScript', () => {
  const WIN = "C:\\Users\\Jo'ao Silva";

  it('a pasta do Windows chega inteira ao wslpath, e a resposta dele vira a pasta do login', () => {
    const out = run(probeScript(WIN), `printf '%s' "$2" > "${join(root, 'asked')}"; printf '%s\\n' "${mounted.replace(/"/g, '\\"')}"`);
    expect(field(out, '__ARGUS_WINHOME__')).toBe(mounted);
    expect(execFileSync('cat', [join(root, 'asked')], { encoding: 'utf8' })).toBe(WIN);
    expect(field(out, '__ARGUS_HOME__')).toBe(root);
  });

  it('sem wslpath, pasta que não existe ou resposta que não é caminho: sem pasta do Windows', () => {
    expect(field(run(probeScript(WIN), null), '__ARGUS_WINHOME__')).toBe('');
    expect(field(run(probeScript(WIN), `printf '%s\\n' "${join(root, 'nada')}"`), '__ARGUS_WINHOME__')).toBe('');
    expect(field(run(probeScript(WIN), 'printf \'%s\\n\' "wslpath: erro"'), '__ARGUS_WINHOME__')).toBe('');
  });
});
