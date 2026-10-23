import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'

// Antes de cada arquivo de teste: pasta pessoal falsa e vazia, para nenhum teste ler ou gravar o
// ~/.claude, o ~/.argus ou as conversas de verdade de quem roda. Removida no fim do arquivo.
const home = mkdtempSync(join(tmpdir(), 'argus-test-'))
process.env.HOME = home
process.env.USERPROFILE = home

// Rodando de dentro de uma conversa do Argus ou do Claude Code, o ambiente traz a pasta de
// configuração e as opções da sessão em uso: o código testado usaria a conversa de verdade.
for (const key of Object.keys(process.env)) {
  if (/^(CLAUDE|ANTHROPIC|ARGUS)_/.test(key) || key === 'CLAUDECODE') delete process.env[key]
}

afterAll(() => rmSync(home, { recursive: true, force: true }))
