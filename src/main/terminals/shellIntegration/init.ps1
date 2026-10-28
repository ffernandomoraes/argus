# Integração do Argus com o shell do drawer (src/main/terminals/shellIntegration.ts). Roda depois dos
# perfis da pessoa, lido como texto (a política de execução de scripts não se aplica), e marca
# prompts e comandos com OSC 133 (ver shellMarks.ts): A antes de cada prompt, C quando um comando
# começa e D quando ele termina, com o código de saída. Vale no PowerShell 5.1 e no 7.

$__argusNonce = ''
$__argusFile = $env:ARGUS_SHELL_NONCE_FILE
Remove-Item -Path Env:ARGUS_SHELL_NONCE_FILE, Env:ARGUS_SHELL_HOOKS -ErrorAction SilentlyContinue
if ($__argusFile) {
  try { $__argusNonce = [System.IO.File]::ReadAllText($__argusFile).Trim() } catch {}
  try { [System.IO.File]::Delete($__argusFile) } catch {}
}
Remove-Variable -Name __argusFile -ErrorAction SilentlyContinue

if ($__argusNonce) {
  # Prompt: o prompt de antes (o padrão, o do oh-my-posh...). LastId: o último comando do histórico,
  # para saber se a linha anterior rodou algo (Enter vazio não marca o fim). Waiting: o prompt já foi
  # marcado e a linha ainda não foi lida; o PSReadLine redesenha o prompt nesse meio (o prompt
  # transitório do oh-my-posh, ao apertar Enter), e isso não é um prompt novo. ExitCode e Error: o
  # $LASTEXITCODE e o último erro quando a linha foi lida (ver o código, abaixo). ParseFailed: a linha
  # lida não se lê como PowerShell e nem rodou.
  $global:__ArgusShell = @{ Nonce = $__argusNonce; LastId = -1; Started = $false; Waiting = $false; Prompt = $function:prompt; ReadLine = $null; ExitCode = $null; Error = $null; ParseFailed = $false }

  function global:prompt {
    $ok = $global:?
    $s = $global:__ArgusShell
    # O código: 1 quando falhou um comando do PowerShell, o do programa quando foi ele que falhou. O
    # $LASTEXITCODE guarda o código do último programa, mesmo de comandos atrás: vale se mudou nesta
    # linha, ou se ela falhou sem erro novo do PowerShell (o mesmo programa, com o mesmo código). Linha
    # com erro de sintaxe não roda e não mexe no $? (no 5.1): 1.
    $code = 0
    if ($s.ParseFailed) { $code = 1 }
    elseif (-not $ok) {
      $code = 1
      $exit = $global:LASTEXITCODE
      $fresh = $global:Error.Count -gt 0 -and -not [object]::ReferenceEquals($global:Error[0], $s.Error)
      if ($exit -and ($exit -ne $s.ExitCode -or -not $fresh)) { $code = $exit }
    }
    $e = [char]27
    $b = [char]7
    $last = Get-History -Count 1
    $id = -1
    if ($last) { $id = $last.Id }
    if ($s.Started -and $id -ne $s.LastId) { [Console]::Write("$e]133;D;$code;nonce=$($s.Nonce)$b") }
    $s.Started = $true
    $s.LastId = $id
    $s.ParseFailed = $false
    # O começo do comando vem da leitura da linha do PSReadLine, que só existe depois de carregado.
    if (-not $s.ReadLine -and (Test-Path Function:\PSConsoleHostReadLine)) {
      $s.ReadLine = $function:PSConsoleHostReadLine
      function global:PSConsoleHostReadLine {
        $line = & $global:__ArgusShell.ReadLine
        $global:__ArgusShell.Waiting = $false
        if ($line -and $line.Trim()) {
          $errors = $null
          [void][System.Management.Automation.Language.Parser]::ParseInput($line, [ref]$null, [ref]$errors)
          $global:__ArgusShell.ParseFailed = $errors.Count -gt 0
          [Console]::Write("$([char]27)]133;C;nonce=$($global:__ArgusShell.Nonce)$([char]7)")
        }
        $line
      }
    }
    # Sem o PSReadLine não há redesenho: todo prompt é novo.
    if (-not $s.ReadLine -or -not $s.Waiting) {
      [Console]::Write("$e]133;A;nonce=$($s.Nonce)$b")
      $s.Waiting = $true
    }
    # O prompt de antes vê o mesmo $? de sempre (o do oh-my-posh pinta o erro por ele).
    if (-not $ok) { Write-Error 'argus' -ErrorAction Ignore }
    $result = ''
    if ($s.Prompt) { $result += $s.Prompt.Invoke() } else { $result = "PS $($executionContext.SessionState.Path.CurrentLocation)> " }
    # Depois do prompt de antes, que pode rodar programas (o oh-my-posh roda o dele).
    $s.ExitCode = $global:LASTEXITCODE
    $s.Error = $null
    if ($global:Error.Count -gt 0) { $s.Error = $global:Error[0] }
    $result
  }
}
Remove-Variable -Name __argusNonce -ErrorAction SilentlyContinue
