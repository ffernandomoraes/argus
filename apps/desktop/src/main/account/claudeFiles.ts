import { createHash } from 'node:crypto';
import { mkdir, opendir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  AGENT_LAYOUT,
  AGENT_SOURCES,
  isAgentFilePath,
  MAX_CLAUDE_FILE_BYTES,
  MAX_CLAUDE_FILES,
  MAX_CLAUDE_TOTAL_BYTES,
  splitAgentPath,
  type AgentSource,
} from '@argus/shared/accountClaude';

// As instruções e skills dos agentes deste computador que vão com a conta (item 1f): do ~/.claude da
// conta principal do Claude, do ~/.codex (ou CODEX_HOME), do ~/.gemini e do ~/.cursor (o que vai de
// cada um: AGENT_LAYOUT, em packages/shared/src/accountClaude.ts). Só texto e com limite de tamanho;
// pastas ocultas, node_modules, atalhos dentro das skills e arquivos com cara de segredo ficam de fora.

// A pasta de cada provedor neste computador.
export function agentHome(source: AgentSource): string {
  if (source === 'codex' && process.env.CODEX_HOME) return resolve(process.env.CODEX_HOME);
  return join(homedir(), `.${source}`);
}

export type LocalFile = { hash: string; content: string };

const SKIP_DIRS = new Set(['node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build']);
const hashOf = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

// Chaves, certificados e credenciais não vão para a conta, nem dentro de uma skill. Pelo nome
// (.env, .pem, id_rsa...) ou por ter uma chave privada no conteúdo (o começo da chave seguido do
// texto dela: o exemplo "-----BEGIN PRIVATE KEY----- ..." num SKILL.md não conta).
const SECRET_NAMES = [
  /^\.env(\..+)?$/i,
  /\.env$/i,
  /\.(pem|key|p12|pfx|keystore|jks|ppk)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\..+)?$/i,
  /^credentials.*\.json$/i,
  /^client_secret.*\.json$/i,
  /^\.?(npmrc|netrc|pypirc)$/i,
];
const PRIVATE_KEY = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]{0,200}?[A-Za-z0-9+/]{40}/;

export function isSecretFile(path: string, content?: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return SECRET_NAMES.some((r) => r.test(name)) || (content !== undefined && PRIVATE_KEY.test(content));
}

// Texto UTF-8 de verdade: binário (com byte nulo, ou que não volta igual) fica de fora.
function asText(buffer: Buffer): string | null {
  if (buffer.includes(0)) return null;
  const text = buffer.toString('utf8');
  return Buffer.byteLength(text, 'utf8') === buffer.length && Buffer.from(text, 'utf8').equals(buffer) ? text : null;
}

// Arquivos de uma área, até `depth` pastas abaixo. O que está logo na área pode ser um atalho (a
// pasta da skill ou o agente num repositório de dotfiles): é seguido; o que estiver mais dentro, não.
type Walk = { home: string; prefix: string; root: string; depth: number };
async function walk({ home, prefix, root, depth }: Walk, out: string[]): Promise<void> {
  const visit = async (dir: string, level: number): Promise<void> => {
    let handle;
    try {
      handle = await opendir(dir);
    } catch {
      return;
    }
    for await (const entry of handle) {
      if (out.length >= MAX_CLAUDE_FILES) return;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const path = join(dir, entry.name);
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        if (level > 0) continue;
        isDir = await stat(path).then((s) => s.isDirectory(), () => false);
      }
      if (isDir) {
        if (level + 1 <= depth) await visit(path, level + 1);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const rel = prefix + relative(home, path).split(sep).join('/');
        if (isAgentFilePath(rel)) out.push(rel);
      }
    }
  };
  await visit(root, 0);
}

// O caminho no disco de um caminho da conta ("codex/AGENTS.md" -> ~/.codex/AGENTS.md).
function diskPath(path: string): { home: string; target: string } {
  const { source, rel } = splitAgentPath(path)!;
  const home = agentHome(source);
  return { home, target: resolve(home, ...rel.split('/')) };
}

// Os arquivos daqui, por caminho na conta. Passou do limite da conta, o resto fica de fora.
export async function scanClaudeFiles(): Promise<Map<string, LocalFile>> {
  const paths: string[] = [];
  for (const source of AGENT_SOURCES) {
    const home = agentHome(source);
    const { prefix, instructions, areas } = AGENT_LAYOUT[source];
    if (instructions && (await stat(join(home, instructions)).then((s) => s.isFile(), () => false))) paths.push(prefix + instructions);
    for (const area of areas) await walk({ home, prefix, root: join(home, area.dir), depth: area.max }, paths);
  }
  const files = new Map<string, LocalFile>();
  let total = 0;
  for (const rel of paths.sort()) {
    if (isSecretFile(rel)) continue;
    const buffer = await readFile(diskPath(rel).target).catch(() => null);
    if (!buffer || buffer.length > MAX_CLAUDE_FILE_BYTES || total + buffer.length > MAX_CLAUDE_TOTAL_BYTES) continue;
    const content = asText(buffer);
    if (content === null || isSecretFile(rel, content)) continue;
    total += buffer.length;
    files.set(rel, { hash: hashOf(content), content });
  }
  return files;
}

// Grava um arquivo que veio da conta. O caminho é conferido de novo aqui: nunca sai da pasta do
// provedor (~/.claude, ~/.codex, ~/.gemini, ~/.cursor).
export async function writeClaudeFile(path: string, content: string): Promise<void> {
  if (!isAgentFilePath(path)) throw new Error(`caminho recusado: ${path}`);
  const { home, target } = diskPath(path);
  if (!target.startsWith(home + sep)) throw new Error(`caminho recusado: ${path}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

export { hashOf as claudeHash };
