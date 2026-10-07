import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '../shared/appSettings'

// Guardadas num JSON nos dados do app.
const DEFAULTS: AppSettings = { menuBarIcon: false }
const file = () => join(app.getPath('userData'), 'settings.json')

export function loadAppSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf8')) }
  } catch {
    return DEFAULTS
  }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadAppSettings(), ...patch }
  try {
    writeFileSync(file(), JSON.stringify(next))
  } catch {
    // Sem gravar, vale só até fechar o app.
  }
  return next
}
