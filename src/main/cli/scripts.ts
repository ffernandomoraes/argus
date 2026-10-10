import { app } from 'electron'
import { MARK, SOCKET } from './locations'
import { OPEN_FLAG } from './openArg'

// O texto dos scripts do `argus`, gravados a cada vez que o app abre.

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// Mac: o script manda o caminho pelo socket local; o app escuta enquanto está aberto.
export function macScript(): string {
  // Empacotado, o comando abre o app se ele estiver fechado. Em desenvolvimento não há .app para abrir.
  const bundle = app.isPackaged ? process.execPath.replace(/\.app\/.*$/, '.app') : null
  const launch = bundle
    ? `open -a ${quote(bundle)} && for _ in $(seq 1 50); do sleep 0.2; send && exit 0; done\n`
    : ''
  return `#!/bin/sh
# Gerado pelo Argus a cada vez que o app abre; mudanças aqui se perdem.
target="\${1:-.}"
dir=$(cd "$target" 2>/dev/null && pwd -P) || { echo "argus: pasta não encontrada: $target" >&2; exit 1; }
send() { curl -sf --unix-socket ${quote(SOCKET)} --data-binary "$dir" http://argus/open >/dev/null 2>&1; }
send && exit 0
${launch}echo "argus: o app não está aberto." >&2
exit 1
`
}

// O cmd lê o .bat linha a linha na página de código do console, que não é UTF-8: o script troca
// para UTF-8 na primeira linha (só com ASCII antes dela) e devolve a original ao sair. Assim o
// caminho do app e a mensagem com acento chegam certos, inclusive com usuário "João".
// Pasta de disco ("C:\") ganha um ponto no fim: a barra antes da aspa viraria aspa literal.
export function windowsScript(): string {
  return [
    '@echo off',
    MARK,
    'rem Gerado pelo Argus a cada vez que o app abre; mudanças aqui se perdem.',
    'setlocal',
    `for /f "tokens=2 delims=:." %%a in ('chcp') do set /a "argus_cp=%%a"`,
    'chcp 65001 >nul',
    'set "target=%~1"',
    'if "%target%"=="" set "target=."',
    'if not exist "%target%\\*" goto missing',
    'for %%I in ("%target%") do set "dir=%%~fI"',
    'if "%dir:~-1%"=="\\" set "dir=%dir%."',
    `start "" ${launchCommand()} "${OPEN_FLAG}%dir%"`,
    'chcp %argus_cp% >nul',
    'exit /b 0',
    '',
    ':missing',
    'echo argus: pasta não encontrada: %target% 1>&2',
    'chcp %argus_cp% >nul',
    'exit /b 1',
    ''
  ].join('\r\n')
}

// Empacotado: o Argus.exe. No pnpm dev: o electron.exe com a pasta do projeto.
function launchCommand(): string {
  return app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${app.getAppPath()}"`
}
