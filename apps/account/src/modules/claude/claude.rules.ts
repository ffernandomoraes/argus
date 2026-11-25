import { createHash } from 'node:crypto';

// Regras dos arquivos dos agentes na conta (Claude, Codex, Gemini, Cursor), iguais às do app
// (packages/shared/src/accountClaude.ts): o servidor não depende do pacote do app, então a conferência
// do caminho está repetida aqui.

export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 1000;
export const MAX_FILES_PER_WRITE = 200;

const SEGMENT = /^[\w@+()[\]{}, =-][\w.@+()[\]{}, =-]*$/;

type Area = { dir: string; min: number; max: number; ext?: string };
const SKILLS: Area = { dir: 'skills', min: 2, max: 6 };
// O Claude sem prefixo (como está no ~/.claude); os outros com o nome na frente.
const LAYOUT: { prefix: string; instructions?: string; areas: Area[] }[] = [
  { prefix: 'codex/', instructions: 'AGENTS.md', areas: [SKILLS] },
  { prefix: 'gemini/', instructions: 'GEMINI.md', areas: [{ dir: 'commands', min: 1, max: 4, ext: '.toml' }] },
  { prefix: 'cursor/', areas: [{ dir: 'commands', min: 1, max: 4, ext: '.md' }, SKILLS] },
  {
    prefix: '',
    instructions: 'CLAUDE.md',
    areas: [SKILLS, { dir: 'agents', min: 1, max: 3, ext: '.md' }, { dir: 'commands', min: 1, max: 4, ext: '.md' }],
  },
];

// Só o arquivo de instruções e as áreas de cada provedor, sem "..", nada oculto e sem barra invertida.
export function isAgentFilePath(path: string): boolean {
  if (path.length > 240 || path.includes('\\')) return false;
  if (path.split('/').some((p) => !SEGMENT.test(p) || p.length > 120)) return false;
  const layout = LAYOUT.find((l) => path.startsWith(l.prefix))!;
  const rel = path.slice(layout.prefix.length);
  if (rel === layout.instructions) return true;
  const [dir, ...rest] = rel.split('/');
  const area = layout.areas.find((a) => a.dir === dir);
  return !!area && rest.length >= area.min && rest.length <= area.max && (!area.ext || rel.endsWith(area.ext));
}

export const hashOf = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

export type FileWrite = { path: string; content: string; hash: string; size: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Corpo de PUT /api/claude: { files: [{ path, content }] }. Texto: o motivo da recusa.
export function parseFiles(body: unknown): FileWrite[] | string {
  const files = isRecord(body) ? body.files : undefined;
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES_PER_WRITE) return 'invalid files';
  const out = new Map<string, FileWrite>();
  for (const f of files) {
    if (!isRecord(f) || typeof f.path !== 'string' || typeof f.content !== 'string') return 'invalid file';
    if (!isAgentFilePath(f.path)) return `invalid path: ${f.path.slice(0, 80)}`;
    if (f.content.includes('\u0000')) return `binary file: ${f.path}`;
    const size = Buffer.byteLength(f.content, 'utf8');
    if (size > MAX_FILE_BYTES) return 'too large';
    out.set(f.path, { path: f.path, content: f.content, hash: hashOf(f.content), size });
  }
  return [...out.values()];
}

// Lista de caminhos (POST /api/claude/read e /api/claude/remove). Texto: o motivo da recusa.
export function parsePaths(body: unknown): string[] | string {
  const paths = isRecord(body) ? body.paths : undefined;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_FILES) return 'invalid paths';
  if (!paths.every((p) => typeof p === 'string' && isAgentFilePath(p))) return 'invalid path';
  return [...new Set(paths as string[])];
}
