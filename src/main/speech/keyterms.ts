// Termos que o serviço deve preferir quando o som for parecido. Os primeiros são os que a
// extensão do VS Code manda; o resto é o vocabulário deste app (inglês no meio do português).
export const KEYTERMS = [
  'VS Code', 'IDE', 'webview', 'IntelliSense', 'MCP', 'symlink', 'grep', 'regex', 'localhost', 'codebase',
  'TypeScript', 'JSON', 'OAuth', 'webhook', 'gRPC', 'dotfiles', 'subagent', 'worktree',
  'drawer', 'tooltip', 'card', 'canvas', 'sidebar', 'navbar', 'modal', 'popup', 'popout', 'badge', 'layout',
  'placeholder', 'checkbox', 'dropdown', 'scroll', 'hover', 'drag', 'drop', 'timeline', 'viewport', 'header',
  'footer', 'dark mode', 'light mode', 'design system', 'token', 'front-end', 'back-end', 'Electron', 'React',
  'JavaScript', 'Node', 'Vite', 'Tailwind', 'pnpm', 'npm', 'Claude', 'Claude Code', 'Opus', 'Sonnet', 'Haiku',
  'SDK', 'API', 'CLI', 'GitHub', 'branch', 'merge', 'pull request', 'commit', 'deploy', 'build', 'debug',
  'log', 'diff', 'refactor', 'endpoint', 'cache', 'props', 'hook', 'render', 'prompt', 'markdown', 'thread',
  'workspace', 'feature', 'release', 'terminal', 'shell', 'bash', 'grid', 'flexbox', 'Canva', 'Argus'
]

// Cabeçalho aceito pelo serviço: só ASCII, separado por vírgula, até 1024 caracteres.
export function keytermsHeader(terms: string[]): string {
  const out: string[] = []
  let size = 0
  for (const term of new Set(terms.map((t) => t.replace(/,/g, ' ').trim()))) {
    if (!term || !/^[\x20-\x7E]+$/.test(term)) continue
    size += term.length + (out.length ? 1 : 0)
    if (size > 1024) break
    out.push(term)
  }
  return out.join(',')
}
