import { readFile } from 'node:fs/promises'

// Salvar só se o arquivo no disco ainda for o que o editor leu (a base). Sem isso, o ⌘S logo depois
// de o Claude editar o arquivo apagava a edição dele: o aviso de mudança do vigia chega uns 150 ms
// depois e ainda passa pelo IPC e pela releitura. A conferência e a gravação não são atômicas, mas a
// janela que sobra é a de uma leitura.
//
// Sem base, não confere (como antes). Arquivo que sumiu não conta como mudado: gravar o recria,
// como antes. Outro erro de leitura também não: a gravação logo depois diz o que houve.
export async function changedOnDisk(file: string, base: string | undefined): Promise<boolean> {
  if (base === undefined) return false
  try {
    return (await readFile(file, 'utf8')) !== base
  } catch {
    return false
  }
}
