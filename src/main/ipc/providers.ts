import { PROVIDERS, type ProviderId } from '../../shared/providers'
import type { Providers } from '../providers'
import { handle, on } from './register'

const valid = (p: unknown): p is ProviderId => PROVIDERS.includes(p as ProviderId)

// Contas dos outros agentes (Codex, Gemini, Cursor).
export function registerProvidersIpc(providers: Providers): void {
  handle('providers:state', () => providers.state)
  handle('providers:clipboardKey', () => providers.clipboardKey())
  on('providers:refresh', (_e, provider) => providers.refresh(valid(provider) ? provider : undefined))
  on('providers:install', (_e, provider) => valid(provider) && providers.install(provider))
  on('providers:add', (_e, provider) => valid(provider) && providers.add(provider))
  on('providers:login', (_e, provider, id) => valid(provider) && providers.login(provider, id))
  on('providers:submitKey', (_e, key) => providers.submitKey(typeof key === 'string' ? key : undefined))
  on('providers:cancel', () => providers.cancel())
  on('providers:remove', (_e, provider, id) => valid(provider) && providers.remove(provider, id))
  on('providers:rename', (_e, provider, id, name) => valid(provider) && providers.rename(provider, id, String(name)))
  on('providers:setDefault', (_e, provider, id) => valid(provider) && providers.setDefault(provider, id))
}
