import { homedir } from 'node:os';
import { join } from 'node:path';
import { errorMessage } from '../lib/errors';
import { readJsonFile, readJsonFileAsync, writeJsonAtomic, writeJsonAtomicSync, type JsonRead } from '../lib/jsonFile';

// Copiados da principal uma vez, ao criar a conta: o terminal dela não repete a apresentação nem
// pergunta de novo se confia em cada pasta, e os MCPs começam iguais (os que pedem login pedem
// de novo, nesta conta). As migrações já feitas vão junto: refeitas aqui, mexeriam nas
// configurações, que são as mesmas da principal.
const SEED_KEYS = new Set([
  'hasCompletedOnboarding',
  'lastOnboardingVersion',
  'installMethod',
  'autoUpdates',
  'autoUpdatesProtectedForNative',
  'mcpServers',
]);
const SEED_MIGRATIONS = /migration|^unpin/i;
const SEED_PROJECT_KEYS = [
  'hasTrustDialogAccepted',
  'allowedTools',
  'mcpServers',
  'mcpContextUris',
  'enabledMcpjsonServers',
  'disabledMcpjsonServers',
  'disabledMcpServers',
  'hasClaudeMdExternalIncludesApproved',
  'hasClaudeMdExternalIncludesWarningShown',
];

function pick(from: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((k) => k in from).map((k) => [k, from[k]]));
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// O .claude.json da conta nova, a partir do da principal. Sem ele (ou ilegível), a conta começa
// do zero, como um Claude Code recém-instalado. `home`: pasta do usuário onde está o da principal
// (a do Linux, numa conta usada no WSL).
export function seed(dir: string, home = homedir()): void {
  const config = seedConfig(readJsonFile(join(home, '.claude.json')));
  if (!config) return;
  try {
    writeJsonAtomicSync(join(dir, '.claude.json'), config, SEED_WRITE);
  } catch (err) {
    console.warn('[accounts] não deu para copiar as configurações da principal:', errorMessage(err));
  }
}

// O mesmo sem segurar o app, para a conta usada no WSL: as duas pastas ficam lá (pela pasta de
// rede), e a cópia síncrona travava tudo enquanto o WSL respondia.
export async function seedAsync(dir: string, home: string): Promise<void> {
  const config = seedConfig(await readJsonFileAsync(join(home, '.claude.json')));
  if (!config) return;
  await writeJsonAtomic(join(dir, '.claude.json'), config, SEED_WRITE).catch((err: unknown) =>
    console.warn('[accounts] não deu para copiar as configurações da principal:', errorMessage(err)),
  );
}

const SEED_WRITE = { indent: 2, mode: 0o600 };

function seedConfig(read: JsonRead<unknown>): Record<string, unknown> | null {
  if (read.status !== 'ok' || !isObject(read.data)) return null;
  const main = read.data;
  const config = Object.fromEntries(Object.entries(main).filter(([k]) => SEED_KEYS.has(k) || SEED_MIGRATIONS.test(k)));
  if (isObject(main.projects)) {
    config.projects = Object.fromEntries(
      Object.entries(main.projects).map(([path, p]) => [path, pick(isObject(p) ? p : {}, SEED_PROJECT_KEYS)]),
    );
  }
  return config;
}
