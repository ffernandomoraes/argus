import { useEffect, useState } from 'react'
import type { ClaudeInfo, ClaudeModel } from '../../../shared/models'

// O que o `claude` informa ao iniciar; chega alguns segundos depois do app abrir.
export function useClaudeInfo(): ClaudeInfo | null {
  const [info, setInfo] = useState<ClaudeInfo | null>(null)
  useEffect(() => {
    window.api.claude.info().then((i) => i && setInfo(i))
    return window.api.claude.onInfo(setInfo)
  }, [])
  return info
}

export function useModels(): ClaudeModel[] {
  return useClaudeInfo()?.models ?? []
}
