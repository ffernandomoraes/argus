// Um `claude` achado na máquina e a versão que ele informa (nula se não respondeu). system: o
// instalado (instalador oficial, npm, Homebrew); editor: o que vem dentro da extensão do VS Code
// (ou do Cursor), que se atualiza sozinha com o editor.
export type ClaudeBinary = { path: string; version: string | null; source: 'system' | 'editor' }

// Qual `claude` o app usa e se ele está atrás da versão publicada.
export type ClaudeVersionState = {
  checking: boolean
  updating: boolean
  // O que o app usa: o mais novo dos achados.
  current: ClaudeBinary | null
  // Os outros achados, para mostrar quando há mais de um.
  others: ClaudeBinary[]
  // Versão mais nova publicada; nula sem internet.
  latest: string | null
  outdated: boolean
  // Bem atrás (outra versão menor, ou 10 ou mais correções): o Claude Code se atualiza sozinho e
  // vive umas poucas versões atrás, o que não merece aviso no menu de modelos.
  farBehind: boolean
  // A última atualização falhou: o fim da saída do `claude update`.
  error: string | null
}
