import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/bundler-plugins/vite'
import type { Plugin } from 'vite'

const BUNDLED = ['@anthropic-ai/claude-agent-sdk', 'zod']

// Mapas de código para o Sentry: com eles, a pilha de um erro mostra o arquivo e a linha do
// código-fonte (src/renderer/...) em vez do arquivo montado. Só no GitHub Actions, com o secret
// SENTRY_AUTH_TOKEN: cada parte do build sobe os mapas dela e os apaga em seguida, então nenhum vai
// no instalador. Sem o token (pnpm dev, build local), nada muda.
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN
const sourcemap = SENTRY_TOKEN ? 'hidden' : false

function sentryMaps(part: 'main' | 'preload' | 'renderer'): Plugin[] {
  if (!SENTRY_TOKEN) return []
  return sentryVitePlugin({
    org: 'fernando-moraes',
    project: 'argus',
    authToken: SENTRY_TOKEN,
    telemetry: false,
    // A versão já vai em cada relatório (o SDK manda Argus@versão): aqui só os mapas.
    release: { inject: false, create: false, finalize: false, setCommits: false, deploy: false },
    sourcemaps: { filesToDeleteAfterUpload: [`out/${part}/**/*.map`] }
  }) as unknown as Plugin[]
}

// Content-Security-Policy da janela, só no build (o app instalado): no pnpm dev o preâmbulo
// inline do React e o recarregamento ao vivo do Vite seriam barrados. O único script inline é o
// do tema no index.html, liberado pelo hash calculado aqui (mudou o script, o hash acompanha).
// Imagens também de data: e blob: (prints colados e os do histórico). Quadros de qualquer http e
// https: a página do protótipo (modo design) pode redirecionar para subdomínio .localhost, 0.0.0.0,
// IP da rede ou um login externo. O quadro é sandbox e o preload não roda nele: não fala com o app.
// Nada de eval: nenhuma dependência da janela usa.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'argus-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // O hash vale para o texto com as quebras de linha em "\n", como o navegador lê o HTML: no
        // Windows o checkout vem com "\r\n", e o hash daquele texto barrava o script de tema.
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1].replace(/\r\n?/g, '\n')).digest('base64')}'`
        )
        const policy = [
          "default-src 'self'",
          ["script-src 'self'", ...inline].join(' '),
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          'frame-src http: https:',
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'none'"
        ].join('; ')
        // Depois do charset (que precisa vir logo no começo do arquivo) e antes do script de tema.
        const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
        return /<meta charset=[^>]*>/i.test(html)
          ? html.replace(/<meta charset=[^>]*>/i, (charset) => `${charset}\n    ${meta}`)
          : html.replace('<head>', `<head>\n    ${meta}`)
      }
    }
  }
}

export default defineConfig({
  main: {
    // SDK e zod entram no próprio código do main: copiar as pastas inteiras para o app levava
    // ~12 MB (o zod sozinho vem com o código-fonte e as versões v3 e v4). Ficam de fora o
    // node-pty, que tem binário nativo, e o ws: embutido, o Vite troca o `bufferutil` opcional
    // por um objeto vazio e o envio de mensagens grandes do ditado quebra.
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED }), ...sentryMaps('main')],
    // O transformers.js (devDependency) entra no código do processo da transcrição; o motor nativo
    // dele (onnxruntime-node) fica de fora, como o node-pty. O sharp vira um vazio (ver sharpStub.ts).
    resolve: {
      alias: { sharp: resolve('src/main/transcription/sharpStub.ts') }
    },
    build: {
      sourcemap,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          transcriber: resolve('src/main/transcription/worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), ...sentryMaps('preload')],
    build: { sourcemap }
  },
  renderer: {
    // Porta fora das comuns (3000, 5173...) para não brigar com outros projetos em dev
    server: { port: 10100 },
    resolve: {
      alias: { '@': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss(), contentSecurityPolicy(), ...sentryMaps('renderer')],
    build: { sourcemap }
  }
})
