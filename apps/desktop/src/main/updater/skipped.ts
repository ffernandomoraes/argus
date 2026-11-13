import { join } from 'node:path'
import { app } from 'electron'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { isNewer } from './releases'

// Versão que quebrou e da qual o usuário voltou (ver app/crashGuard.ts). A atualização automática
// não leva de volta para ela: só para uma mais nova, que traga a correção.
const file = () => join(app.getPath('userData'), 'skipped-version.json')

export function skippedVersion(): string | null {
  const r = readJsonFile<{ version?: unknown }>(file())
  const version = r.status === 'ok' ? r.data?.version : null
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? version : null
}

// Guarda a maior: quem volta da 0.1.44 depois de ter voltado da 0.1.45 continua pulando a 0.1.45.
export function skipVersion(version: string): void {
  const current = skippedVersion()
  if (current && !isNewer(version, current)) return
  try {
    writeJsonAtomicSync(file(), { version })
  } catch {
    // Sem gravar, a atualização automática pode trazer a versão de volta; o aviso aparece de novo.
  }
}

// Só atualiza para o que for mais novo que esta: a versão em uso ou a pulada, a maior das duas.
export function updateFloor(current: string): string {
  const skipped = skippedVersion()
  return skipped && isNewer(skipped, current) ? skipped : current
}
