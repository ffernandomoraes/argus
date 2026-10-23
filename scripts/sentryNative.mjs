// Compila o módulo nativo do detector de travamento do Sentry (@sentry/node-native-stacktrace) para
// o Electron do projeto. O pacote só traz binário pronto para o Node, e o Electron tem outra versão
// de ABI: sem isto, o app abre normalmente, só sem avisar quando o processo principal trava (ver
// src/main/errorReports). Roda no GitHub Actions antes de montar o app, em cada sistema; na máquina
// de desenvolvimento não precisa (lá o envio de erros fica desligado).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

// O pacote é dependência do @sentry/node-native, não do projeto: procurado a partir dele.
const nodeNative = dirname(require.resolve('@sentry/node-native/package.json'))
const dir = dirname(realpathSync(createRequire(join(nodeNative, 'package.json')).resolve('@sentry/node-native-stacktrace/package.json')))
const electron = JSON.parse(readFileSync(require.resolve('electron/package.json'), 'utf8')).version

console.log(`[sentryNative] compilando ${dir} para o Electron ${electron} (${process.arch})`)
// shell no Windows: o pnpm de lá é um .cmd.
execFileSync(
  'pnpm',
  ['dlx', 'node-gyp', 'rebuild', '--runtime=electron', `--target=${electron}`, `--arch=${process.arch}`, '--dist-url=https://electronjs.org/headers'],
  { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' }
)

const binary = join(dir, 'build', 'Release', 'stack-trace.node')
if (!existsSync(binary)) {
  console.error(`[sentryNative] o binário não apareceu em ${binary}`)
  process.exit(1)
}
console.log(`[sentryNative] pronto: ${binary}`)
