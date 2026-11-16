import { describe, expect, it } from 'vitest';
import type { WinProcess } from '../winProcesses';
import { winOrigin } from './winFamily';

const ARGUS = 100;
let next = 1000;
const proc = (name: string, command = name, pid = next++): WinProcess => ({ pid, ppid: 0, name, command, created: 0 });
const argus = proc('Argus.exe', 'Argus.exe', ARGUS);

describe('winOrigin', () => {
  it('servidor MCP aberto pelo Claude (direto ou por cmd /c) é do Claude', () => {
    expect(winOrigin([proc('node.exe'), proc('claude.exe'), argus], ARGUS)).toEqual({ claude: true, launched: false });
    expect(winOrigin([proc('node.exe'), proc('cmd.exe'), proc('claude.exe')], ARGUS)).toEqual({ claude: true, launched: false });
  });

  it('servidor da ferramenta Bash do Claude conta, dentro ou fora do Argus', () => {
    const vite = [proc('node.exe'), proc('cmd.exe'), proc('node.exe', 'pnpm.cjs dev'), proc('bash.exe')];
    expect(winOrigin([...vite, proc('claude.exe')], ARGUS)).toEqual({ claude: false, launched: true });
    expect(winOrigin([...vite, proc('node.exe', 'C:\\npm\\@anthropic-ai\\claude-code\\cli.js'), argus], ARGUS)).toEqual({ claude: false, launched: true });
  });

  it('servidor aberto num terminal do Argus conta (pwsh, cmd, Git Bash)', () => {
    for (const shell of ['pwsh.exe', 'powershell.exe', 'cmd.exe', 'bash.exe']) {
      expect(winOrigin([proc('node.exe'), proc(shell), argus], ARGUS).launched).toBe(true);
    }
  });

  it('processo do próprio Argus, sem shell no meio, não conta', () => {
    expect(winOrigin([proc('codex.exe'), argus], ARGUS).launched).toBe(false);
    expect(winOrigin([argus], ARGUS).launched).toBe(false);
  });

  it('servidor de fora (outro terminal, serviço do Windows) não conta', () => {
    expect(winOrigin([proc('node.exe'), proc('pwsh.exe'), proc('WindowsTerminal.exe')], ARGUS)).toEqual({ claude: false, launched: false });
    expect(winOrigin([proc('postgres.exe'), proc('services.exe')], ARGUS).launched).toBe(false);
  });
});
