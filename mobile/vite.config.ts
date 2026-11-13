import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// O app do celular (PWA). O build vai para relay/public: a ponte (Worker em relay/) serve a página no
// mesmo endereço em que liga os aparelhos ao Argus de casa. Publicar: pnpm mobile:build e
// `cf-pessoal wrangler deploy` dentro de relay/.
//
// pnpm mobile:dev abre só a página, com a ponte de VITE_RELAY_URL (ex.: ws://127.0.0.1:8787 do
// `wrangler dev`, ou a de produção).
const root = fileURLToPath(new URL('.', import.meta.url))
// A versão do app do celular é a do Argus no package.json de quando foi montado.
const version = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    outDir: fileURLToPath(new URL('../relay/public', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022'
  },
  server: { host: true, port: 5180 }
})
