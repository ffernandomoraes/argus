import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A pasta do pacote, achada subindo a partir deste arquivo: vale no `tsx` (src/) e no build (dist/).

const PACKAGE_NAME = '@argus/account';

let cachedRoot: string | undefined;

export function packageRoot(): string {
  if (cachedRoot) return cachedRoot;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
      if (name === PACKAGE_NAME) {
        cachedRoot = dir;
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the ${PACKAGE_NAME} package root`);
    dir = parent;
  }
}

export const migrationsFolder = (): string => path.join(packageRoot(), 'drizzle');
