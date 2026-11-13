import type { Api } from '@argus/shared/api'

// O formato de `window.api` mora em packages/shared/src/api.ts (o mesmo tipo que o preload implementa).
declare global {
  interface Window {
    api: Api
  }
}
