// Tamanho da janela de contexto de cada modelo, em tokens. O arquivo da sessão não grava
// esse número; ele vem nas respostas do Claude (modelUsage.contextWindow) ao usar o chat.
const learned = new Map<string, number>()

export function learnContextWindow(model: string, tokens: number): void {
  if (tokens > 0) learned.set(model, tokens)
}

// Antes de aprender: Haiku e modelos anteriores à família 5 têm 200 mil; Opus e Sonnet 5.x,
// 1 milhão (conferido com o próprio Claude Code em 2026-10-06). "[1m]" no nome força 1 milhão.
export function contextWindowFor(model: string): number {
  const known = learned.get(model)
  if (known) return known
  if (model.includes('[1m]')) return 1_000_000
  if (model.includes('haiku')) return 200_000
  const major = /claude-[a-z]+-(\d+)/.exec(model)?.[1]
  return major && Number(major) >= 5 ? 1_000_000 : 200_000
}
