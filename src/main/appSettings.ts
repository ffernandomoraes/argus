import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '../shared/appSettings'
import { readJsonFile, writeJsonAtomicSync } from './lib/jsonFile'

// Guardadas num JSON nos dados do app.
const DEFAULTS: AppSettings = { menuBarIcon: false }
const file = () => join(app.getPath('userData'), 'settings.json')

export function loadAppSettings(): AppSettings {
  const r = readJsonFile<Partial<AppSettings>>(file())
  const saved = r.status === 'ok' && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {}
  return { ...DEFAULTS, ...saved }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadAppSettings(), ...patch }
  try {
    writeJsonAtomicSync(file(), next)
  } catch {
    // Sem gravar, vale só até fechar o app.
  }
  return next
}
