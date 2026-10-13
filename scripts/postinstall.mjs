// Roda depois do `pnpm install`.
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Electron 44 só baixa o binário no primeiro require; o electron-vite precisa dele antes.
require('electron')

// O pacote do node-pty vem com o spawn-helper sem permissão de execução,
// e sem ela o terminal falha com "posix_spawnp failed".
for (const arch of ['darwin-arm64', 'darwin-x64']) {
  const helper = `node_modules/node-pty/prebuilds/${arch}/spawn-helper`
  if (existsSync(helper)) chmodSync(helper, 0o755)
}

if (process.platform === 'darwin') {
  buildSpeechHelper()
}

if (process.platform === 'linux') {
  buildNodePty()
}

// O node-pty não traz binário pronto para Linux (só Mac e Windows), e o pnpm não roda o script de
// compilação dele (allowBuilds em pnpm-workspace.yaml). Aqui ele é compilado uma vez, pelo
// node-gyp; precisa de make, g++ e python3 (o pacote build-essential no Ubuntu). É N-API: o mesmo
// binário serve ao Node e ao Electron.
function buildNodePty() {
  const dir = 'node_modules/node-pty'
  if (existsSync(`${dir}/build/Release/pty.node`)) return
  try {
    execFileSync('pnpm', ['dlx', 'node-gyp', 'rebuild'], { cwd: dir, stdio: 'inherit' })
  } catch {
    console.warn('[postinstall] Não consegui compilar o node-pty (precisa de make, g++ e python3): o terminal não vai abrir.')
  }
}

// Programa de ditado (reconhecimento de fala do macOS), em Swift.
function buildSpeechHelper() {
  const dir = 'native/speech'
  mkdirSync(`${dir}/build`, { recursive: true })
  try {
    execFileSync('swiftc', [
      '-O', `${dir}/main.swift`, '-o', `${dir}/build/speech-helper`,
      '-framework', 'AVFoundation',
      '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', `${dir}/Info.plist`
    ], { stdio: 'inherit' })
  } catch {
    console.warn('[postinstall] Não consegui compilar o ditado (precisa do swiftc, das Command Line Tools da Apple).')
  }
}
