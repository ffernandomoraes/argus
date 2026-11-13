// Atualização do app pelos releases do GitHub.
export type UpdateState =
  // Em desenvolvimento, ou rodando de um lugar onde não dá para trocar o app (o .dmg, por exemplo).
  | { status: 'unsupported'; reason: string }
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'latest' }
  // required: a versão em uso está muito atrás da última (ver updater/index.ts), e a tela fica
  // coberta até atualizar (RequiredUpdateModal).
  | { status: 'downloading'; version: string; progress: number; required?: boolean }
  // Baixada e conferida: entra ao reiniciar, ou sozinha quando o app fechar.
  | { status: 'ready'; version: string; notesUrl: string; required?: boolean }
  // Windows: a versão nova saiu, mas o instalador dela ainda não subiu (sai alguns minutos depois
  // do app do Mac). Não é erro: procurar de novo daqui a pouco resolve.
  | { status: 'waiting'; version: string; message: string }
  | { status: 'error'; message: string }

// Notas de uma versão publicada, lidas do release no GitHub (Novidades, na barra de título).
// kind: a etiqueta da frente da linha ([BUG], [MELHORIA], [FUNCIONALIDADE]); null sem etiqueta.
export type ReleaseNoteKind = 'bug' | 'improvement' | 'feature'
export type ReleaseNote = {
  version: string
  date: string | null
  url: string
  items: { kind: ReleaseNoteKind | null; text: string }[]
}

export type UpdateInfo = {
  // Versão em uso, a do package.json.
  version: string
  state: UpdateState
}
