// Conversa gravada pelo Claude Code em ~/.claude/projects/<pasta>/<id>.jsonl.
import type { LiveStatus } from './history'

export type SessionSummary = {
  // Id da sessão (nome do arquivo); serve para `claude --resume`.
  id: string
  title: string
  // Última gravação no arquivo, em ISO.
  updatedAt: string
  // Quanto da janela de contexto a última resposta ocupou, de 0 a 100.
  contextPercent: number
  // Nulo: nenhum processo do Claude Code está com a sessão aberta.
  live: LiveStatus | null
  // Conversa de um protótipo do modo design (começou com as instruções <modo-design>).
  design?: boolean
}

// Pasta onde o Claude Code já conversou (lista do "Nova pasta").
export type KnownFolder = {
  // Caminho absoluto, como o Claude Code gravou.
  path: string
  // Conversa mais recente da pasta, em ISO.
  updatedAt: string
}

// Arquivo com mudança ainda não comitada no repositório da pasta.
export type UncommittedFile = {
  // Caminho absoluto.
  path: string
  // Letra do VS Code: M alterado, A adicionado, D apagado, R renomeado, U novo (fora do git),
  // ! em conflito.
  kind: 'M' | 'A' | 'D' | 'R' | 'U' | '!'
}

// Por que a pasta mudou, no aviso sessions:changed: a lista de conversas mudou (transcript: uma
// conversa gravou, apareceu, ou um design dela mudou), o status de algum Claude Code mudou (status)
// ou o .git mudou (git: checkout, add, commit). A janela relê só o que o motivo pede: o git status,
// o mais caro, só no aviso do git.
export type SessionChange = 'transcript' | 'status' | 'git'
