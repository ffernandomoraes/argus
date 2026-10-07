// Situação do comando `cae` em ~/.local/bin.
export type CliStatus = {
  installed: boolean
  // Instalado, mas o shell não vai encontrar o comando.
  warning?: string
  // Não deu para instalar.
  error?: string
}
