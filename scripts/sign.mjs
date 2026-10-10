// Gancho afterPack do electron-builder: assina o .app antes de virar .dmg e .zip.
// Sem conta paga da Apple, o certificado é autoassinado (MAC_SIGN_IDENTITY, nome ou SHA-1).
// Ele mantém a mesma identidade entre versões, e o macOS não pede de novo microfone e ditado.
// Sem a variável, na máquina de quem desenvolve, assina ad-hoc: o app abre, mas cada versão conta
// como um app novo. No CI (variável CI), sem ela a montagem falha: um release ad-hoc seria recusado
// pelo atualizador de todos os Macs (a assinatura não bateria com a do app instalado).
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export default async function sign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const identity = process.env.MAC_SIGN_IDENTITY || '-'
  if (identity === '-' && process.env.CI) {
    throw new Error('MAC_SIGN_IDENTITY não definida no CI: o app sairia com assinatura ad-hoc. Confira os secrets do certificado.')
  }
  const keychain = process.env.MAC_SIGN_KEYCHAIN
  execFileSync('codesign', [
    '--force', '--deep', '--sign', identity,
    ...(keychain ? ['--keychain', keychain] : []),
    app
  ], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  console.log(`  • assinado (${identity === '-' ? 'ad-hoc' : identity})`)
}
