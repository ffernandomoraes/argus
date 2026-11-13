// Linux: o Chromium isola as janelas (sandbox) por um recurso do kernel (user namespaces) ou, sem
// ele, pelo programa chrome-sandbox com permissão de root. No AppImage o chrome-sandbox nunca tem
// essa permissão, e o Ubuntu 24.04 bloqueia o recurso do kernel para programas sem perfil do
// AppArmor: o app nem abre ("The SUID sandbox helper binary was found, but is not configured
// correctly"). O --no-sandbox precisa vir na linha de comando: o Chromium checa o isolamento antes
// do código do app rodar, e o app.commandLine.appendSwitch chega tarde.
// Por isso o executável vira argus-bin e, no lugar dele, entra um script que confere o kernel e só
// desliga o isolamento quando ele não funcionaria. O AppImage, o atalho do menu e o atualizador
// abrem pelo nome original, e passam pelo script.
import { chmodSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const script = (bin) => `#!/bin/sh
dir=$(dirname "$(readlink -f "$0")")
sandbox="$dir/chrome-sandbox"
blocked=0
[ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = 1 ] && blocked=1
[ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = 0 ] && blocked=1
[ "$(cat /proc/sys/user/max_user_namespaces 2>/dev/null)" = 0 ] && blocked=1
if [ "$blocked" = 1 ] && ! { [ -u "$sandbox" ] && [ "$(stat -c %u "$sandbox" 2>/dev/null)" = 0 ]; }; then
  exec "$dir/${bin}" --no-sandbox "$@"
fi
exec "$dir/${bin}" "$@"
`

export default async function linuxLauncher(context) {
  if (context.electronPlatformName !== 'linux') return
  const name = context.packager.executableName
  const exe = join(context.appOutDir, name)
  renameSync(exe, `${exe}-bin`)
  writeFileSync(exe, script(`${name}-bin`))
  chmodSync(exe, 0o755)
  console.log(`  • lançador ${name} -> ${name}-bin (desliga o sandbox só onde o kernel bloqueia)`)
}
