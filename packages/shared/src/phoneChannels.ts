import type { UnreadChat } from './chat';
import type { HistoryRequest } from './history';
import type { HistoryHave, HistoryPatch } from './historyPatch';
import type { DesktopPreferences, SharedPreferences } from './phonePreferences';

// Canais do Argus usados pelo app do celular (e o vaivém com a janela que eles precisam), fora do
// ipc.ts para ele não passar do tamanho. Entram nos tipos de lá (InvokeChannels etc.).

// Uma pasta do computador e as subpastas dela (o "Procurar no Mac" do celular).
export type FolderListing = { path: string; parent: string | null; folders: { name: string; path: string }[] };

// Pedido à janela do Argus: encaixar a pasta no canvas (`nodes`, o workspace como está), no grupo
// `groupId` (nulo: fora de grupo), com a mesma lógica de quando se adiciona pela janela.
export type PlaceFolderRequest = { id: string; nodes: unknown; path: string; groupId: string | null };

export type AddFolderResult = { ok: true } | { ok: false; error: string };

export type PhoneInvokeChannels = {
  // O que o app do celular herda do Argus: padrão das conversas, sugestões, tema e idioma.
  'preferences:forPhone': () => DesktopPreferences
  // Adiciona a pasta ao workspace `board` (pelo celular).
  'canvas:addFolder': (board: string, path: string, groupId: string | null) => AddFolderResult
  // Subpastas de uma pasta do computador; nulo ou vazio: a pasta pessoal. Nulo de volta: não deu para ler.
  'folders:list': (path: string | null) => FolderListing | null
  // Conversas com resposta que ninguém viu ainda (a bolinha verde), somando as janelas do Argus.
  'chat:unreadList': () => UnreadChat[]
  // O trecho do histórico como o sessions:historyPage, mas só com o que o celular não tem (ver historyPatch.ts).
  'sessions:historyPatch': (path: string, id: string, request: HistoryRequest, have: HistoryHave) => HistoryPatch
};

export type PhoneSendChannels = {
  // A janela do Argus conta o padrão das conversas novas e as sugestões ao abrir e quando mudam (o
  // app do celular herda).
  'preferences:share': (prefs: SharedPreferences) => void
  // Resposta da janela ao pedido de encaixar uma pasta: o workspace com ela, ou o erro.
  'canvas:placedFolder': (id: string, nodes: unknown, error: string | null) => void
  // O celular abriu a conversa: as janelas do Argus tiram a bolinha verde dela.
  'chat:markRead': (id: string) => void
};

export type PhoneEventChannels = {
  'canvas:placeFolder': (request: PlaceFolderRequest) => void
  // A lista das não vistas mudou (o celular acompanha).
  'chat:unreadList': (chats: UnreadChat[]) => void
  // Vista em outro lugar (no celular): a janela tira a bolinha verde.
  'chat:markedRead': (id: string) => void
};
