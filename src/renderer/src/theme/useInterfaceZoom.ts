import { useEffect } from 'react'
import { usePreference } from '../settings/preferences'

// Aplica o tamanho da interface (Configurações > Aparência) nesta janela. Trocado numa janela, as
// outras recebem pela preferência salva.
export function useInterfaceZoom(): void {
  const zoom = usePreference('interfaceZoom')
  useEffect(() => window.api.setInterfaceZoom(zoom), [zoom])
}
