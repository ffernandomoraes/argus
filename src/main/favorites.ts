import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

// Conversas favoritas, como a janela do Argus guarda (nos ajustes dela): a janela conta para cá ao
// abrir e a cada mudança, e o app do celular lê daqui. Guardadas num arquivo para o celular ver
// mesmo antes de a janela abrir.

const file = () => join(app.getPath('userData'), 'favorite-chats.json')
let cache: string[] | null = null

export function favoriteChats(): string[] {
  if (cache) return cache
  try {
    const raw: unknown = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : []
    cache = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
  } catch {
    cache = []
  }
  return cache
}

// Devolve se mudou.
export function setFavoriteChats(ids: unknown): boolean {
  const next = Array.isArray(ids) ? [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length <= 200))].slice(0, 1000) : []
  if (JSON.stringify(next) === JSON.stringify(favoriteChats())) return false
  cache = next
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file(), JSON.stringify(next))
  } catch (err) {
    console.error('[favoritas] não deu para gravar:', err)
  }
  return true
}
