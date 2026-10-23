import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testes (pnpm test). Lógica pura do núcleo: conversas, sessões, histórico, projetos e caminhos.
// Sem Electron de verdade: o 'electron' importado vira o substituto de test/electron.ts. Cada
// arquivo de teste roda com uma pasta pessoal (HOME) falsa e vazia (ver test/setup.ts): nada lê nem
// grava o ~/.claude de quem roda.
const root = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: { electron: root('test/electron.ts') }
  },
  test: {
    environment: 'node',
    setupFiles: [root('test/setup.ts')],
    projects: [
      { extends: true, test: { name: 'main', include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'] } },
      // A interface: o window.api do preload é trocado por um falso (ver test/rendererSetup.ts).
      {
        extends: true,
        resolve: { alias: { '@': root('src/renderer/src') } },
        test: { name: 'renderer', include: ['src/renderer/**/*.test.ts'], setupFiles: [root('test/rendererSetup.ts')] }
      }
    ]
  }
})
