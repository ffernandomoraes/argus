import type { TaskOutputChunk, TaskOutputRef } from './backgroundTasks';
import type { HistoryPage, HistoryRequest, Message } from './history';
import type { BranchList, BranchOption, KnownFolder, PullResult, SearchHit, SessionSummary, UncommittedFile } from './sessions';

// Pedidos com resposta sobre as conversas do Claude Code de cada pasta e o git dela (ver ipc.ts).
export type SessionsInvokeChannels = {
  'sessions:list': (path: string) => SessionSummary[] | null
  'sessions:folders': () => KnownFolder[]
  'sessions:search': (path: string, query: string) => SearchHit[]
  'sessions:trash': (path: string, id: string) => string | null
  'sessions:exists': (path: string) => boolean
  'sessions:relocate': (from: string, to: string) => string | null
  'sessions:move': (from: string, to: string, id: string) => string | null
  'sessions:branch': (path: string) => string | null
  'sessions:branches': (path: string) => BranchList | null
  'sessions:fetch': (path: string) => boolean
  'sessions:checkout': (path: string, option: BranchOption, create?: boolean) => string | null
  'sessions:pull': (path: string) => PullResult
  'sessions:repoUrl': (path: string) => string | null
  'sessions:changes': (path: string) => UncommittedFile[] | null
  'sessions:history': (path: string, id: string) => Message[]
  'sessions:historyPage': (path: string, id: string, request: HistoryRequest) => HistoryPage
  'sessions:taskOutput': (ref: TaskOutputRef, offset: number) => TaskOutputChunk
  'sessions:subagentPage': (path: string, id: string, toolUseId: string, request: HistoryRequest) => HistoryPage
  'sessions:images': (path: string, id: string, messageId: string) => string[]
  // Imagem que o Claude leu ou citou na conversa (o caminho tem que aparecer nela), pronta para o <img>.
  'sessions:image': (path: string, id: string, file: string) => string | null
};
