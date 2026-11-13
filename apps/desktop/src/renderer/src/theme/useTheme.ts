import { useEffect, useState } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const KEY = 'theme'

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'system' ? v : 'dark'
  } catch {
    return 'dark'
  }
}

const systemTheme = (): ResolvedTheme => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

// Tema da interface. A escolha fica salva neste computador; "sistema" segue o macOS.
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)
  const resolved: ResolvedTheme = preference === 'system' ? system : preference

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystem(systemTheme())
    // Trocar o tema numa janela reflete nas outras (janelas de conversa).
    const onStorage = (e: StorageEvent) => e.key === KEY && setPreference(readPreference())
    media.addEventListener('change', onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    // Menus nativos, barras de rolagem e o seletor de pastas acompanham o tema.
    window.api.setTheme(preference)
    try {
      localStorage.setItem(KEY, preference)
    } catch {
      // Sem armazenamento, o tema só não fica salvo.
    }
  }, [preference, resolved])

  return { preference, resolved, setPreference }
}
