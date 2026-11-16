import type { WinProcess } from '../winProcesses';
import { CLAUDE_SCRIPT } from './family';

// Quem abriu um processo com porta aberta no Windows, pela família dele (ele e os de cima, do pai
// ao mais antigo). Lógica pura, testada em winFamily.test.ts.

// Shells da ferramenta Bash do Claude Code. O cmd fica de fora: servidor MCP costuma vir de
// "cmd /c npx ...", e esse é do Claude.
const TOOL_SHELL = /^(bash|sh|zsh|powershell|pwsh)\.exe$/i;
// Shells de um terminal do Argus (o cmd também, aberto à mão ou como shell padrão).
const ANY_SHELL = /^(bash|sh|zsh|powershell|pwsh|cmd|nu)\.exe$/i;

const isClaude = (p: WinProcess) => /^claude\.exe$/i.test(p.name) || CLAUDE_SCRIPT.test(p.command);

export type WinOrigin = {
  // Do Claude Code: ele mesmo ou o que ele abriu direto (servidores MCP). Não é servidor de projeto.
  claude: boolean
  // Servidor que alguém iniciou por um shell: a ferramenta Bash do Claude Code (dentro ou fora do
  // Argus) ou um terminal deste Argus. É o que no Mac as marcas do ambiente dizem (processScan/marks.ts).
  launched: boolean
};

// `family`: o processo e os de cima. `argusPid`: o processo principal deste Argus.
export function winOrigin(family: WinProcess[], argusPid: number): WinOrigin {
  const at = family.findIndex(isClaude);
  const claude = at >= 0 && !family.slice(0, at).some((p) => TOOL_SHELL.test(p.name));
  if (claude) return { claude, launched: false };
  if (at >= 0) return { claude, launched: true };
  // Aberto num terminal deste Argus: um shell entre ele e o Argus. Sem shell no meio é processo do
  // próprio Argus (os agentes, os ajudantes dele), não servidor de projeto.
  const argus = family.findIndex((p) => p.pid === argusPid);
  return { claude, launched: argus > 0 && family.slice(0, argus).some((p) => ANY_SHELL.test(p.name)) };
}
