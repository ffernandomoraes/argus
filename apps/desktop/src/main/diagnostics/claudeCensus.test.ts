import { describe, expect, it } from 'vitest';
import { isClaudeCommand } from '../processScan/family';
import { countClaudes, programName, type Proc } from './claudeCensus';

// Quantos Claude Code rodam fora do Argus e quem abriu cada um: confirma ou descarta "outro programa
// renovou o mesmo login" no aviso de login perdido.

const isClaude = (p: Proc) => isClaudeCommand(p.command);
const OWN = 100;

describe('Claude Code rodando', () => {
  it('separa os do Argus dos de fora, e diz quem abriu os de fora', () => {
    const procs: Proc[] = [
      { pid: OWN, ppid: 1, command: '/Applications/Argus.app/Contents/MacOS/Argus' },
      { pid: 200, ppid: OWN, command: '/Users/ana/.local/bin/claude -p --input-format stream-json' },
      { pid: 210, ppid: OWN, command: '/bin/zsh -l' },
      { pid: 211, ppid: 210, command: 'claude --resume abc' },
      { pid: 300, ppid: 1, command: '-zsh' },
      { pid: 301, ppid: 300, command: 'claude' },
      { pid: 400, ppid: 1, command: '/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin) --type=utility' },
      { pid: 401, ppid: 400, command: '/Users/ana/.vscode/extensions/anthropic.claude-code-2.1.300/resources/native-binary/claude --output-format stream-json' },
      { pid: 500, ppid: 1, command: '/Applications/Claude.app/Contents/MacOS/Claude' },
    ];
    expect(countClaudes(procs, isClaude, OWN)).toEqual({ total: 4, outsideArgus: 2, parents: ['-zsh', 'Code Helper (Plugin)'] });
  });

  it('o claude aberto por outro claude conta uma vez só', () => {
    const procs: Proc[] = [
      { pid: 300, ppid: 1, command: 'bash' },
      { pid: 301, ppid: 300, command: 'claude' },
      { pid: 302, ppid: 301, command: 'claude -p' },
    ];
    expect(countClaudes(procs, isClaude, OWN)).toEqual({ total: 1, outsideArgus: 1, parents: ['bash'] });
  });

  it('nome do programa, sem pasta', () => {
    expect(programName({ pid: 1, ppid: 0, command: '/usr/local/bin/fish -l' })).toBe('fish');
    expect(programName({ pid: 1, ppid: 0, command: '"C:\\Program Files\\x\\Code.exe" --type=renderer' })).toBe('Code.exe');
    expect(programName({ pid: 1, ppid: 0, command: '', name: 'WindowsTerminal.exe' })).toBe('WindowsTerminal.exe');
    expect(programName(undefined)).toBe('?');
  });
});
