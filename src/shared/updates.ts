// Atualização do app pelos releases do GitHub.
export type UpdateState =
  // Em desenvolvimento, ou rodando de um lugar onde não dá para trocar o app (o .dmg, por exemplo).
  | { status: 'unsupported'; reason: string }
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'latest' }
  | { status: 'downloading'; version: string; progress: number }
  // Baixada e conferida: entra ao reiniciar, ou sozinha quando o app fechar.
  | { status: 'ready'; version: string; notesUrl: string }
  // Windows: a versão nova saiu, mas o instalador dela ainda não subiu (sai alguns minutos depois
  // do app do Mac). Não é erro: procurar de novo daqui a pouco resolve.
  | { status: 'waiting'; version: string; message: string }
  | { status: 'error'; message: string }

export type UpdateInfo = {
  // Versão em uso, a do package.json.
  version: string
  state: UpdateState
}
