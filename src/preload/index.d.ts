import type { Api } from '../shared/api'

// O formato de `window.api` mora em src/shared/api.ts (o mesmo tipo que o preload implementa).
declare global {
  interface Window {
    api: Api
  }
}
