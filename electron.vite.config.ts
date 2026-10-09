import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BUNDLED = ['@anthropic-ai/claude-agent-sdk', 'zod']

export default defineConfig({
  main: {
    // SDK e zod entram no próprio código do main: copiar as pastas inteiras para o app levava
    // ~12 MB (o zod sozinho vem com o código-fonte e as versões v3 e v4). Ficam de fora o
    // node-pty, que tem binário nativo, e o ws: embutido, o Vite troca o `bufferutil` opcional
    // por um objeto vazio e o envio de mensagens grandes do ditado quebra.
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // Porta fora das comuns (3000, 5173...) para não brigar com outros projetos em dev
    server: { port: 10100 },
    resolve: {
      alias: { '@': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss()]
  }
})
