import type { DiffHunk } from './history';

export type FileEntry = {
  name: string
  // Caminho relativo à raiz do projeto, com "/".
  path: string
  isDir: boolean
  // Ignorado pelo .gitignore: aparece apagado na árvore.
  ignored: boolean
};

export type FileContent =
  | { ok: true; text: string; size: number; truncated: boolean }
  | { ok: false; error: string };

// Mudanças do arquivo desde o último commit (preparadas ou não), como o diff do VS Code.
// Arquivo novo, fora do git: tudo como linha adicionada. hunks vazio: sem mudanças.
export type FileDiff = { ok: true; hunks: DiffHunk[] } | { ok: false; error: string };

// Busca no painel de código. Nomes: todos os arquivos do projeto (sem o que o .gitignore esconde),
// filtrados na própria janela a cada tecla. truncated: o projeto tinha mais que o limite.
export type FileNameList = { files: string[]; truncated: boolean };

export type TextSearchOptions = { caseSensitive: boolean; wholeWord: boolean; regex: boolean };

// Uma linha encontrada: o número (1 = primeira), o trecho mostrado (sem o recuo; linha longa vem
// cortada em volta do achado) e onde o termo está dentro do trecho, [início, fim).
export type TextSearchMatch = { line: number; text: string; ranges: [number, number][] };
export type TextSearchFile = { path: string; matches: TextSearchMatch[] };

// cancelled: uma busca mais nova da mesma janela tomou o lugar desta.
export type TextSearchResult =
  | { ok: true; files: TextSearchFile[]; total: number; truncated: boolean }
  | { ok: false; error: string; cancelled?: boolean };

// Editores de código que abrem um arquivo numa linha pelo link deles.
export type CodeEditorId = 'vscode' | 'cursor';

// Canais do painel de código além dos básicos (entram em InvokeChannels e SendChannels, em ipc.ts).
export type CodePanelChannels = {
  // Busca: os nomes de todos os arquivos e o texto dentro deles.
  'files:names': (root: string) => FileNameList
  'files:search': (root: string, query: string, options: TextSearchOptions) => TextSearchResult
  // Arrastar na árvore: move itens para uma pasta; soltar do Finder: copia os caminhos para ela.
  'files:move': (root: string, rels: string[], dir: string) => FileOpResult
  'files:import': (paths: string[], root: string, dir: string) => FileOpResult
  // Volta o arquivo ao último commit (novo: vai para a Lixeira).
  'files:discard': (root: string, rel: string) => FileOpResult
  'files:editors': () => CodeEditorId[]
};

export type CodePanelSendChannels = {
  'files:openInEditor': (root: string, rel: string, at: { editor: CodeEditorId; line?: number }) => void
};

// Criar, renomear, excluir, colar, salvar. `path`: o item criado ou renomeado, relativo à raiz.
// conflict: ao salvar com a base, o arquivo no disco já não era ela (alguém mudou por fora); nada
// foi gravado.
export type FileOpResult = { ok: true; path: string } | { ok: false; error: string; conflict?: boolean };

// Tamanho máximo de um anexo pela janela de acesso remoto (vai inteiro numa mensagem da ligação, que
// aceita até 64 MB).
export const MAX_REMOTE_UPLOAD = 50 * 1024 * 1024;

// Documentos, imagens e mídia: o visualizador do sistema mostra (Quick Look no Mac, app padrão no
// Windows e no Linux). O editor de código só mostraria lixo.
const SYSTEM_VIEW = (
  'pdf doc docx xls xlsx ppt pptx odt ods odp rtf pages numbers key epub ' +
  'png jpg jpeg gif webp bmp ico icns tif tiff heic avif psd ai sketch fig ' +
  'mp3 wav ogg flac m4a aac mp4 mov avi mkv webm'
).split(' ');
// Fontes, compactados e executáveis: nem o editor nem o visualizador. Abrir um .exe pelo app
// padrão rodaria o programa; o máximo é mostrar no Finder ou no Explorador.
const ONLY_REVEAL = (
  'woff woff2 ttf otf eot ' +
  'zip gz tgz tar rar 7z bz2 xz dmg pkg iso exe msi dll so dylib bin wasm jar class pyc o a sqlite db'
).split(' ');

export const NO_PREVIEW = new Set([...SYSTEM_VIEW, ...ONLY_REVEAL]);

// O que fazer com um arquivo que não abre no editor, pela extensão. null = abre no editor.
export function outsideEditor(path: string): 'view' | 'reveal' | null {
  const ext = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
  if (SYSTEM_VIEW.includes(ext)) return 'view';
  return ONLY_REVEAL.includes(ext) ? 'reveal' : null;
}
